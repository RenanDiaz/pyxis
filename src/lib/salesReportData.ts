/**
 * salesReportData.ts
 * -----------------------------------------------------------------------------
 * Transforma los datos del CRM (clientes → procesos → pagos) al modelo de
 * entrada del reporte de ventas (`ReportInput`) para un mes concreto.
 *
 * Reglas de mapeo (ver decisiones en el SPEC):
 *  - Una "cuenta" del reporte = un PROCESO contratado con al menos un pago en el
 *    mes seleccionado ("una cuenta = una venta").
 *  - Solo se incluyen los pagos cuya fecha cae dentro del mes (`yyyy-MM`).
 *  - `stateFee` se deriva del documento del estado (states.json).
 *  - `registeredAgent` no se registra en el CRM → 0.
 *  - `stripeFee` solo se calcula para los pagos cuyo método es `stripe`; se deja
 *    en 0 o se estima (2.9% + $0.30) según `stripeFeeMode`. Los pagos hechos con
 *    cualquier otro método nunca tienen comisión de Stripe.
 * -----------------------------------------------------------------------------
 */

import type { Client, ClientProcess, Payment, StateInfo } from '@/types'
import { getProcessLabel, localMonthKey, parsePaymentDate } from '@/lib/processUtils'
import { getClientDisplayName } from '@/lib/clientUtils'
import type { ExpenseConfig, ReportAccount, ReportInput } from '@/lib/generateSalesReport'

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
  subtractRegisteredAgent: boolean
  stripeFeeMode: StripeFeeMode
}

/** Convierte "$245", "245.0", "N/A" → número (0 si no es parseable). */
function parseMoney(raw: string | undefined): number {
  if (!raw) return 0
  const num = parseFloat(raw.replace(/[$,]/g, ''))
  return Number.isNaN(num) ? 0 : num
}

/**
 * Pagos del proceso que caen en el mes objetivo (comparado en hora LOCAL, no
 * por `slice` del string: un ISO en UTC puede caer en el mes vecino cerca de la
 * frontera). Cada pago llega con su `Date` ya parseada y quedan ordenados.
 */
function monthPaymentsOf(
  process: ClientProcess,
  monthKey: string,
): Array<{ payment: Payment; date: Date }> {
  return (process.payments ?? [])
    .map((payment) => ({ payment, date: parsePaymentDate(payment.date) }))
    .filter(
      (x): x is { payment: Payment; date: Date } =>
        x.date !== null && localMonthKey(x.date) === monthKey,
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

function estimateStripeFee(charge: number, mode: StripeFeeMode): number {
  if (mode === 'none') return 0
  if (charge <= 0) return 0
  return Math.round((charge * STRIPE_PERCENT + STRIPE_FLAT) * 100) / 100
}

/**
 * Construye el `ReportInput` para el mes dado. Las cuentas quedan ordenadas por
 * la fecha del primer pago (mismo criterio que el reporte original) y numeradas
 * en ese orden por el generador.
 */
export function buildReportInput(params: BuildReportParams): ReportInput {
  const { clients, states, monthKey, monthLabel, expenses, subtractRegisteredAgent, stripeFeeMode } =
    params

  const stateFeeByAbbr = new Map<string, number>()
  for (const s of states) {
    stateFeeByAbbr.set(s.abbreviation.toUpperCase(), parseMoney(s.state_fee))
  }

  const accounts: ReportAccount[] = []

  for (const client of clients) {
    const processes = client.processes ?? []
    for (const process of processes) {
      // Pagos del proceso que caen en el mes objetivo, ordenados por fecha.
      const monthPayments = monthPaymentsOf(process, monthKey)

      if (monthPayments.length === 0) continue

      const stateAbbr = (process.state || client.state || '').toUpperCase()
      const stateFee = stateAbbr ? stateFeeByAbbr.get(stateAbbr) ?? 0 : 0

      accounts.push({
        company: client.llc_name?.trim() || getClientDisplayName(client),
        purchase: getProcessLabel(process.type),
        state: process.state || client.state || '',
        stateFee,
        registeredAgent: 0,
        owner: getClientDisplayName(client),
        payments: monthPayments.map(({ payment, date }) => ({
          date,
          charge: payment.amount,
          // La comisión de Stripe solo aplica a los pagos hechos con Stripe.
          stripeFee:
            payment.method === 'stripe' ? estimateStripeFee(payment.amount, stripeFeeMode) : 0,
        })),
      })
    }
  }

  // Orden por fecha del primer pago de cada cuenta.
  accounts.sort(
    (a, b) => a.payments[0].date.getTime() - b.payments[0].date.getTime()
  )

  return { monthLabel, accounts, expenses, subtractRegisteredAgent }
}

/**
 * Resumen ligero para mostrar en la UI antes de exportar (sin construir el
 * workbook): cuántas cuentas y pagos entran en el mes y el total cobrado.
 */
export interface ReportPreview {
  accountCount: number
  paymentCount: number
  totalCharge: number
}

export function previewReport(
  clients: Client[],
  monthKey: string
): ReportPreview {
  let accountCount = 0
  let paymentCount = 0
  let totalCharge = 0

  for (const client of clients) {
    for (const process of client.processes ?? []) {
      const monthPayments = monthPaymentsOf(process, monthKey)
      if (monthPayments.length === 0) continue
      accountCount += 1
      paymentCount += monthPayments.length
      totalCharge += monthPayments.reduce((sum, { payment }) => sum + payment.amount, 0)
    }
  }

  return { accountCount, paymentCount, totalCharge }
}
