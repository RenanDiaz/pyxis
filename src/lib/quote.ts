import { addDays, format } from 'date-fns'
import type { Client, ClientProcess, StateInfo } from '@/types'
import { getSuggestedPrice } from '@/lib/processUtils'
import { roundMoney, sumMoney } from '@/lib/money'

// Cotización (spec 15): oferta de precio antes de que el cliente pague. No
// muestra pagos: es el precio completo de los servicios elegidos.

export const DEFAULT_QUOTE_VALID_DAYS = 15
export const MAX_QUOTE_VALID_DAYS = 90

export interface QuoteLine {
  process: ClientProcess
  price: number
}

export interface Quote {
  number: string
  issuedAt: Date
  validUntil: Date
  lines: QuoteLine[]
  total: number
}

/** Precio inicial en el diálogo: el total acordado, o el sugerido del estado. */
export function defaultQuotePrice(process: ClientProcess, state: StateInfo | null | undefined): number | null {
  if (process.total && process.total > 0) return process.total
  return getSuggestedPrice(process.type, state) ?? null
}

/** Procesos marcados por defecto: los que siguen vigentes. */
export function isQuotableByDefault(process: ClientProcess): boolean {
  return process.stage !== 'cancelado' && process.stage !== 'completado'
}

/** `COT-yyMMdd-XXXX-HHmm`: referencia para que el cliente la mencione al pagar. */
export function quoteNumber(client: Pick<Client, 'id'>, at: Date): string {
  return `COT-${format(at, 'yyMMdd')}-${client.id.slice(-4).toUpperCase()}-${format(at, 'HHmm')}`
}

export function buildQuote(
  client: Pick<Client, 'id'>,
  lines: QuoteLine[],
  { now = new Date(), validDays = DEFAULT_QUOTE_VALID_DAYS }: { now?: Date; validDays?: number } = {},
): Quote {
  if (lines.length === 0) throw new Error('La cotización necesita al menos un servicio')
  const rounded = lines.map((l) => ({ ...l, price: roundMoney(l.price) }))
  return {
    number: quoteNumber(client, now),
    issuedAt: now,
    validUntil: addDays(now, Math.min(Math.max(Math.round(validDays), 1), MAX_QUOTE_VALID_DAYS)),
    lines: rounded,
    total: sumMoney(rounded.map((l) => l.price)),
  }
}
