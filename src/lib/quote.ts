import { addDays, format } from 'date-fns'
import type { Client, ClientProcess, StateInfo } from '@/types'
import { getProcessLabel, getSuggestedPrice } from '@/lib/processUtils'
import { getProcessCompanyName } from '@/lib/companyUtils'
import { roundMoney, sumMoney } from '@/lib/money'

// Cotización (spec 15): oferta de precio antes de que el cliente pague. No
// muestra pagos. Se arma desde un cliente (sus procesos) o, como cotización
// rápida, desde un estado sin cliente registrado.

export const DEFAULT_QUOTE_VALID_DAYS = 15
export const MAX_QUOTE_VALID_DAYS = 90

/** Una línea del PDF: servicio, detalle opcional (p. ej. la LLC) y precio. */
export interface QuoteLine {
  label: string
  detail?: string
  price: number
}

export interface Quote {
  number: string
  issuedAt: Date
  validUntil: Date
  /** A quién va dirigida; vacío en una cotización rápida sin nombre. */
  recipient?: string
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

/** Línea de cotización para un proceso del cliente. */
export function processQuoteLine(client: Client, process: ClientProcess, price: number): QuoteLine {
  const company = getProcessCompanyName(client, process)
  return {
    label: getProcessLabel(process) + (process.state ? ` — ${process.state}` : ''),
    ...(company && { detail: company }),
    price,
  }
}

/**
 * `COT-yyMMdd-XXXX-HHmm`: referencia para que el cliente la mencione al pagar.
 * `ref` son los últimos 4 caracteres del id del cliente, o un código al azar
 * en la cotización rápida.
 */
export function quoteNumber(ref: string, at: Date): string {
  return `COT-${format(at, 'yyMMdd')}-${ref.slice(-4).toUpperCase()}-${format(at, 'HHmm')}`
}

export function randomRef(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase()
}

export function buildQuote({
  ref,
  recipient,
  lines,
  now = new Date(),
  validDays = DEFAULT_QUOTE_VALID_DAYS,
}: {
  ref: string
  recipient?: string
  lines: QuoteLine[]
  now?: Date
  validDays?: number
}): Quote {
  if (lines.length === 0) throw new Error('La cotización necesita al menos un servicio')
  const rounded = lines.map((l) => ({ ...l, price: roundMoney(l.price) }))
  const name = recipient?.trim()
  return {
    number: quoteNumber(ref, now),
    issuedAt: now,
    validUntil: addDays(now, Math.min(Math.max(Math.round(validDays), 1), MAX_QUOTE_VALID_DAYS)),
    ...(name && { recipient: name }),
    lines: rounded,
    total: sumMoney(rounded.map((l) => l.price)),
  }
}
