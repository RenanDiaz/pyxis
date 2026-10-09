/**
 * salesReportData.ts
 * -----------------------------------------------------------------------------
 * Transforma los datos del CRM (clientes → procesos → pagos) al modelo de
 * entrada del reporte de ventas (`ReportInput`) para un mes concreto.
 *
 * Reglas de mapeo (ver decisiones en el SPEC):
 *  - Una "cuenta" del reporte = un PROCESO contratado ("una cuenta = una venta").
 *  - La venta cuenta en el mes de su FECHA DE VENTA (`getProcessSaleDate`:
 *    `sold_at`, o la más temprana entre la creación y el primer pago), no en el
 *    del primer pago: una venta cerrada a fin de mes y cobrada el siguiente es
 *    del mes en que se cerró (spec 04, P10).
 *  - Una vez que el proceso pertenece al mes, se incluyen TODOS sus pagos, aunque
 *    alguno se haya hecho en otro mes (es parte de la misma venta y no debe
 *    contarse aparte en el mes en que se cobró). Sin pagos no entra (aún).
 *  - `stateFee` se deriva del documento del estado del PROCESO (states.json).
 *    Sin `process.state` va en 0 y la UI lo advierte: no se usa `client.state`,
 *    que puede ser el de otra compañía del cliente (spec 04).
 *  - El costo del Registered Agent no se registra en el CRM → columna H en 0;
 *    si el proceso incluye Registered Agent (`has_registered_agent`), las
 *    fórmulas de TAX y NET de esa cuenta restan H (se puede completar en Excel).
 *  - `stripeFee` solo se calcula para los pagos cuyo método es `stripe`; se deja
 *    en 0 o se estima (2.9% + $0.30) según `stripeFeeMode`. Los pagos hechos con
 *    cualquier otro método nunca tienen comisión de Stripe.
 * -----------------------------------------------------------------------------
 */

import type { Client, ClientProcess, Payment, StateInfo } from '@/types'
import {
  getProcessLabel,
  getProcessSaleDate,
  hasRegisteredAgent,
  localMonthKey,
  parsePaymentDate,
} from '@/lib/processUtils'
import { getClientDisplayName } from '@/lib/clientUtils'
import { getProcessCompanyName } from '@/lib/companyUtils'
import type { ExpenseConfig, ReportAccount, ReportInput } from '@/lib/generateSalesReport'
import { sumMoney } from '@/lib/money'

export type StripeFeeMode = 'none' | 'estimate'

// Stripe: 2.9% + $0.30 por transacción (estimación estándar).
const STRIPE_PERCENT = 0.029
const STRIPE_FLAT = 0.3

export interface BuildReportParams {
  clients: Client[]
  states: StateInfo[]
  /** Mes objetivo en formato `yyyy-MM`. */
  monthKey: string
  /** Rótulo de la hoja, ej. "June" o "Junio 2025". */
  monthLabel: string
  expenses: ExpenseConfig
  stripeFeeMode: StripeFeeMode
  taxRate: number
}

/** Convierte "$245", "245.0", "N/A" → número (0 si no es parseable). */
function parseMoney(raw: string | undefined): number {
  if (!raw) return 0
  const num = parseFloat(raw.replace(/[$,]/g, ''))
  return Number.isNaN(num) ? 0 : num
}

/**
 * Todos los pagos del proceso con su `Date` ya parseada, ordenados por fecha.
 * Se descartan los pagos sin fecha válida. La comparación de mes se hace en hora
 * LOCAL (no por `slice` del string: un ISO en UTC puede caer en el mes vecino
 * cerca de la frontera).
 */
function sortedPaymentsOf(
  process: ClientProcess,
): Array<{ payment: Payment; date: Date }> {
  return (process.payments ?? [])
    .map((payment) => ({ payment, date: parsePaymentDate(payment.date) }))
    .filter((x): x is { payment: Payment; date: Date } => x.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Pagos del proceso si su fecha de venta cae en el mes `monthKey` (TODOS sus
 * pagos, de cualquier mes); si no, `[]` (el proceso pertenece a otro mes).
 */
function monthPaymentsOf(
  process: ClientProcess,
  monthKey: string,
): Array<{ payment: Payment; date: Date }> {
  const saleDate = getProcessSaleDate(process)
  if (!saleDate || localMonthKey(saleDate) !== monthKey) return []
  return sortedPaymentsOf(process)
}

function estimateStripeFee(charge: number, mode: StripeFeeMode): number {
  if (mode === 'none') return 0
  if (charge <= 0) return 0
  return Math.round((charge * STRIPE_PERCENT + STRIPE_FLAT) * 100) / 100
}

/**
 * Construye el `ReportInput` para el mes dado. Las cuentas quedan ordenadas por
 * fecha de venta y numeradas en ese orden por el generador.
 */
export function buildReportInput(params: BuildReportParams): ReportInput {
  const { clients, states, monthKey, monthLabel, expenses, stripeFeeMode, taxRate } = params

  const stateFeeByAbbr = new Map<string, number>()
  for (const s of states) {
    stateFeeByAbbr.set(s.abbreviation.toUpperCase(), parseMoney(s.state_fee))
  }

  const entries: Array<{ saleTime: number; account: ReportAccount }> = []

  for (const client of clients) {
    const processes = client.processes ?? []
    for (const process of processes) {
      // Pagos del proceso que caen en el mes objetivo, ordenados por fecha.
      const monthPayments = monthPaymentsOf(process, monthKey)

      if (monthPayments.length === 0) continue

      const stateAbbr = (process.state ?? '').toUpperCase()
      const stateFee = stateAbbr ? stateFeeByAbbr.get(stateAbbr) ?? 0 : 0

      const account: ReportAccount = {
        // Cada registro de LLC es una compañía distinta: se reporta la del
        // proceso, no la del cliente.
        // Un registro sin nombre propio no toma `client.llc_name` (sería la
        // compañía de otro registro); los demás procesos sí son de esa compañía.
        company:
          (process.type === 'registration'
            ? getProcessCompanyName(client, process)
            : client.llc_name?.trim()) || getClientDisplayName(client),
        purchase: getProcessLabel(process),
        state: process.state ?? '',
        stateFee,
        registeredAgent: 0,
        hasRegisteredAgent: hasRegisteredAgent(process),
        owner: getClientDisplayName(client),
        payments: monthPayments.map(({ payment, date }) => ({
          date,
          charge: payment.amount,
          // La comisión de Stripe solo aplica a los pagos hechos con Stripe.
          stripeFee:
            payment.method === 'stripe' ? estimateStripeFee(payment.amount, stripeFeeMode) : 0,
        })),
      }
      entries.push({ saleTime: getProcessSaleDate(process)!.getTime(), account })
    }
  }

  // Orden por fecha de venta (y, a igual fecha, por el primer pago).
  entries.sort(
    (a, b) =>
      a.saleTime - b.saleTime ||
      a.account.payments[0].date.getTime() - b.account.payments[0].date.getTime()
  )

  return { monthLabel, accounts: entries.map((e) => e.account), expenses, taxRate }
}

/**
 * Resumen ligero para mostrar en la UI antes de exportar (sin construir el
 * workbook): cuántas cuentas y pagos entran en el mes y el total cobrado.
 */
export interface ReportPreview {
  accountCount: number
  paymentCount: number
  totalCharge: number
  /** Cuentas del mes sin estado en el proceso: su state fee sale en 0. */
  missingState: string[]
}

export function previewReport(
  clients: Client[],
  monthKey: string
): ReportPreview {
  let accountCount = 0
  let paymentCount = 0
  let totalCharge = 0
  const missingState: string[] = []

  for (const client of clients) {
    for (const process of client.processes ?? []) {
      const monthPayments = monthPaymentsOf(process, monthKey)
      if (monthPayments.length === 0) continue
      accountCount += 1
      paymentCount += monthPayments.length
      totalCharge = sumMoney([totalCharge, ...monthPayments.map(({ payment }) => payment.amount)])
      if (!process.state) {
        missingState.push(`${getClientDisplayName(client)} — ${getProcessLabel(process)}`)
      }
    }
  }

  return { accountCount, paymentCount, totalCharge, missingState }
}
