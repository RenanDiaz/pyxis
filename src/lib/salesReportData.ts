/**
 * salesReportData.ts
 * -----------------------------------------------------------------------------
 * Transforma los datos del CRM (clientes → procesos → pagos) al modelo de
 * entrada del reporte de ventas (`ReportInput`) para un mes concreto.
 *
 * Reglas de mapeo (spec 04):
 *  - Una "cuenta" del reporte = un PROCESO vendido = UNA fila (P6).
 *  - Una venta es un proceso con al menos un pago: sin pagos es un prospecto o
 *    una cotización, no una venta.
 *  - La venta cuenta en el mes de su FECHA DE VENTA (`getProcessSaleDate`), no
 *    en el del primer pago: una venta cerrada a fin de mes y cobrada el
 *    siguiente es del mes en que se cerró (P10).
 *  - CHARGE = total acordado del proceso, aunque falte cobrar parte (lo que
 *    importa es que aparezcan todas las ventas). Sin total, lo cobrado. El saldo
 *    pendiente es un monto PROYECTADO: se advierte en el diálogo de exportación,
 *    no en el Excel.
 *  - `stateFee` se deriva del documento del estado del PROCESO (states.json).
 *    Sin `process.state` va en 0 y la UI lo advierte: no se usa `client.state`,
 *    que puede ser el de otra compañía del cliente.
 *  - Registered Agent (#9): Pyxis no guarda su costo; si el proceso lo incluye
 *    (`has_registered_agent`), H = `registeredAgentCost` (45 por defecto, como
 *    el Excel manual); si no, 0.
 *  - Stripe (P5): el cliente paga un RECARGO del 4 % sobre lo que paga con
 *    Stripe, y Pyxis guarda el pago SIN recargo (el recargo no es venta, spec 18).
 *    Como el Excel manual, el recargo se suma a CHARGE y se resta como STRIPE FEE
 *    (efecto neutro en NET). El saldo pendiente se proyecta con el método del
 *    PRIMER pago: si fue Stripe, también lleva recargo. Con `stripeFeeMode`
 *    `'none'` no se suma ni se resta nada.
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
import { fromCents, sumMoney, toCents } from '@/lib/money'

/** `surcharge` = recargo del 4 % como el Excel manual; `none` = sin recargo. */
export type StripeFeeMode = 'surcharge' | 'none'

/** Recargo que paga el cliente sobre lo cobrado con Stripe (Excel manual). */
export const STRIPE_SURCHARGE_RATE = 0.04

/** Costo del Registered Agent por cuenta que lo incluye (Excel manual). */
export const DEFAULT_REGISTERED_AGENT_COST = 45

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
  /** Costo del Registered Agent (columna H) de las cuentas que lo incluyen. */
  registeredAgentCost: number
}

/** Convierte "$245", "245.0", "N/A" → número (0 si no es parseable). */
function parseMoney(raw: string | undefined): number {
  if (!raw) return 0
  const num = parseFloat(raw.replace(/[$,]/g, ''))
  return Number.isNaN(num) ? 0 : num
}

function stripeSurcharge(amount: number, mode: StripeFeeMode): number {
  if (mode === 'none' || amount <= 0) return 0
  return fromCents(Math.round(toCents(amount) * STRIPE_SURCHARGE_RATE))
}

/** Una venta del mes, con lo cobrado y lo proyectado ya calculados. */
interface MonthSale {
  client: Client
  process: ClientProcess
  saleDate: Date
  /** Pagos con fecha válida, ordenados por fecha. */
  payments: Payment[]
  /** Total acordado (o lo cobrado si no hay total, o si se cobró de más). */
  charge: number
  /** Parte de `charge` que falta cobrar: monto proyectado. */
  pending: number
}

/**
 * Ventas cuyo `getProcessSaleDate` cae en `monthKey` y que tienen al menos un
 * pago, ordenadas por fecha de venta. Base común del reporte y su vista previa.
 */
function monthSalesOf(clients: Client[], monthKey: string): MonthSale[] {
  const sales: MonthSale[] = []
  for (const client of clients) {
    for (const process of client.processes ?? []) {
      const saleDate = getProcessSaleDate(process)
      if (!saleDate || localMonthKey(saleDate) !== monthKey) continue
      // La comparación es en hora LOCAL: un ISO en UTC puede caer en el mes vecino.
      const payments = (process.payments ?? [])
        .map((payment) => ({ payment, time: parsePaymentDate(payment.date)?.getTime() }))
        .filter((x): x is { payment: Payment; time: number } => x.time !== undefined)
        .sort((a, b) => a.time - b.time)
        .map((x) => x.payment)
      if (payments.length === 0) continue
      const paid = toCents(sumMoney(payments.map((p) => p.amount)))
      const charge = Math.max(toCents(process.total), paid)
      sales.push({
        client,
        process,
        saleDate,
        payments,
        charge: fromCents(charge),
        pending: fromCents(charge - paid),
      })
    }
  }
  return sales.sort((a, b) => a.saleDate.getTime() - b.saleDate.getTime())
}

/** "CLIENTE — Proceso", para las advertencias de la UI. */
function saleLabel(sale: MonthSale): string {
  return `${getClientDisplayName(sale.client)} — ${getProcessLabel(sale.process)}`
}

/** El saldo se proyecta con el método del primer pago (P6). */
function projectsStripe(sale: MonthSale): boolean {
  return sale.pending > 0 && sale.payments[0].method === 'stripe'
}

/**
 * Construye el `ReportInput` para el mes dado: una cuenta por venta, ordenadas
 * por fecha de venta y numeradas en ese orden por el generador.
 */
export function buildReportInput(params: BuildReportParams): ReportInput {
  const {
    clients, states, monthKey, monthLabel, expenses, stripeFeeMode, taxRate, registeredAgentCost,
  } = params

  const stateFeeByAbbr = new Map<string, number>()
  for (const s of states) {
    stateFeeByAbbr.set(s.abbreviation.toUpperCase(), parseMoney(s.state_fee))
  }

  const accounts = monthSalesOf(clients, monthKey).map((sale): ReportAccount => {
    const { client, process } = sale
    const stateAbbr = (process.state ?? '').toUpperCase()
    // El recargo aplica a lo pagado con Stripe, y al saldo si el primer pago
    // fue con Stripe. Se suma a CHARGE y se resta como STRIPE FEE.
    const stripeBase = sumMoney([
      ...sale.payments.filter((p) => p.method === 'stripe').map((p) => p.amount),
      projectsStripe(sale) ? sale.pending : 0,
    ])
    const surcharge = stripeSurcharge(stripeBase, stripeFeeMode)

    return {
      date: sale.saleDate,
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
      charge: sumMoney([sale.charge, surcharge]),
      stateFee: stateAbbr ? stateFeeByAbbr.get(stateAbbr) ?? 0 : 0,
      registeredAgent: hasRegisteredAgent(process) ? registeredAgentCost : 0,
      stripeFee: surcharge,
      owner: getClientDisplayName(client),
    }
  })

  return { monthLabel, accounts, expenses, taxRate }
}

/** Venta con saldo pendiente: su CHARGE incluye un monto proyectado. */
export interface ProjectedSale {
  label: string
  pending: number
  /** El saldo se proyectó como pago con Stripe (método del primer pago). */
  stripe: boolean
}

/**
 * Resumen ligero para mostrar en la UI antes de exportar (sin construir el
 * workbook): cuántas ventas entran en el mes, cuánto suman y qué falta cobrar.
 */
export interface ReportPreview {
  accountCount: number
  /** Suma de CHARGE: lo vendido en el mes, cobrado o no. */
  totalCharge: number
  /** Parte de `totalCharge` que falta cobrar (proyectada). */
  totalPending: number
  /** Ventas del mes sin estado en el proceso: su state fee sale en 0. */
  missingState: string[]
  projected: ProjectedSale[]
}

export function previewReport(clients: Client[], monthKey: string): ReportPreview {
  const sales = monthSalesOf(clients, monthKey)
  return {
    accountCount: sales.length,
    totalCharge: sumMoney(sales.map((s) => s.charge)),
    totalPending: sumMoney(sales.map((s) => s.pending)),
    missingState: sales.filter((s) => !s.process.state).map(saleLabel),
    projected: sales
      .filter((s) => s.pending > 0)
      .map((s) => ({ label: saleLabel(s), pending: s.pending, stripe: projectsStripe(s) })),
  }
}
