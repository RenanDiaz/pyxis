import type { StateInfo, Client, ClientProcess, ProcessStage, Payment } from '@/types'
import { PROCESSES } from '@/data/processes'
import { fromCents, sumMoney, toCents } from '@/lib/money'

export function getProcessDef(type: string) {
  return PROCESSES.find((p) => p.id === type)
}

/**
 * Etiqueta visible de un proceso. Para procesos `custom` (extraordinarios, no
 * listados en el catálogo) usa el nombre libre que capturó el agente.
 */
export function getProcessLabel(process: { type: string; custom_label?: string }): string {
  if (process.type === 'custom') {
    return process.custom_label?.trim() || 'Proceso personalizado'
  }
  return getProcessDef(process.type)?.label ?? process.type
}

/**
 * Precio sugerido para un proceso. Para procesos derivados del estado se lee
 * del documento del estado; para `fixed` es el monto fijo; para `manual` no hay
 * sugerencia (lo captura el agente).
 */
export function getSuggestedPrice(type: string, state?: StateInfo | null): number | null {
  const def = getProcessDef(type)
  if (!def) return null
  switch (def.pricing.mode) {
    case 'fixed':
      return def.pricing.amount
    case 'manual':
      return null
    case 'state': {
      if (!state) return null
      const raw = getFieldValue(state, def.pricing.key)
      if (raw === '—') return null
      const num = parseFloat(raw.replace(/[$,]/g, ''))
      return isNaN(num) ? null : num
    }
  }
}

/** Por qué no se conoce el costo estatal de un proceso (ver `getProcessStateCost`). */
export type MissingCostReason = 'no_state' | 'no_state_value' | 'manual'

/**
 * Costo estatal / del proveedor de un proceso: el STATE FEE del reporte de
 * ventas (spec 04, P8). Prioridad: el capturado en el proceso (`state_cost`),
 * luego el del catálogo (`ProcessDef.cost`): fijo, o leído del documento del
 * estado. Si no se puede saber, `cost: null` con el motivo.
 */
export function getProcessStateCost(
  process: Pick<ClientProcess, 'type' | 'state' | 'state_cost'>,
  state?: StateInfo | null,
): { cost: number; reason?: undefined } | { cost: null; reason: MissingCostReason } {
  if (typeof process.state_cost === 'number' && process.state_cost >= 0) {
    return { cost: process.state_cost }
  }
  const def = getProcessDef(process.type)
  // `custom` no vive en el catálogo: su costo siempre es manual.
  const cost = def?.cost ?? { mode: 'manual' as const }
  switch (cost.mode) {
    case 'fixed':
      return { cost: cost.amount }
    case 'manual':
      return { cost: null, reason: 'manual' }
    case 'state': {
      if (!process.state || !state) return { cost: null, reason: 'no_state' }
      const num = parseFloat(getFieldValue(state, cost.key).replace(/[$,]/g, ''))
      return isNaN(num) ? { cost: null, reason: 'no_state_value' } : { cost: num }
    }
  }
}

export function getFieldValue(state: StateInfo, key: string): string {
  const parts = key.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = state
  for (const part of parts) {
    if (value == null || typeof value !== 'object') return '—'
    value = value[part as keyof typeof value]
  }
  return typeof value === 'string' ? value : '—'
}

export function formatFieldValue(
  raw: string,
  format: 'currency' | 'integer' | 'text',
): string {
  if (raw === '—') return raw
  if (format === 'text') return raw

  // Strip existing $ and commas, then parse
  const num = parseFloat(raw.replace(/[$,]/g, ''))
  if (isNaN(num)) return raw

  if (format === 'currency') {
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  // integer
  return Math.round(num).toString()
}

// ── Agregados a nivel proceso / cliente ──

export function getProcessPaid(process: ClientProcess): number {
  return sumMoney((process.payments ?? []).map((p) => p.amount))
}

/** Saldo del proceso redondeado a centavos (negativo si se pagó de más). */
export function getProcessBalance(process: ClientProcess): number {
  return fromCents(toCents(process.total) - toCents(getProcessPaid(process)))
}

// ── Fechas de pago ──

/**
 * Parsea la fecha de un pago a `Date` en hora local, tolerando ambos formatos:
 *  - `yyyy-MM-dd` (legacy, solo fecha) → medianoche LOCAL (nunca UTC, para no
 *    correr un día en zonas con offset negativo); `dateOnly: true`.
 *  - ISO con hora (`2026-06-23T19:00:00.000Z`) → `new Date(value)`; `dateOnly: false`.
 * Devuelve `null` si el valor no es parseable.
 *
 * Único punto de parseo de fechas de pago: usarlo en todos los lectores
 * (timeline, home, reporte, recibos) elimina la clase de bug de desfase UTC.
 */
export function parsePaymentDateParts(
  value: string | undefined | null,
): { date: Date; dateOnly: boolean } | null {
  if (!value || typeof value !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return isNaN(d.getTime()) ? null : { date: d, dateOnly: true }
  }
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : { date: d, dateOnly: false }
}

/** Igual que `parsePaymentDateParts` pero devuelve solo la `Date` (o `null`). */
export function parsePaymentDate(value: string | undefined | null): Date | null {
  return parsePaymentDateParts(value)?.date ?? null
}

/** Clave de mes (`yyyy-MM`) en hora LOCAL de una fecha. */
export function localMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Fecha local como `yyyy-MM-dd` (valor de un `<input type="date">`). */
export function localDateKey(d: Date): string {
  return `${localMonthKey(d)}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Fecha de venta del proceso: el mes en que el reporte de ventas lo cuenta.
 * `sold_at` si el agente la fijó (una venta cerrada antes de su primer pago o
 * capturada tarde); si no, la fecha del primer pago. `created_at` NO sirve: un
 * proceso se agrega al cotizar a un prospecto, a veces un mes antes de venderse.
 */
export function getProcessSaleDate(process: ClientProcess): Date | null {
  const sold = /^(\d{4})-(\d{2})-(\d{2})$/.exec(process.sold_at ?? '')
  if (sold) {
    const d = new Date(Number(sold[1]), Number(sold[2]) - 1, Number(sold[3]))
    if (!isNaN(d.getTime())) return d
  }
  let first: Date | null = null
  for (const p of process.payments ?? []) {
    const d = parsePaymentDate(p.date)
    if (d && (!first || d.getTime() < first.getTime())) first = d
  }
  return first
}

/**
 * Convierte la fecha (y opcionalmente la hora) elegidas en el formulario al
 * formato de guardado (ISO con hora), interpretando los inputs en hora LOCAL:
 *  - Si se pasa `timeInput` (`HH:mm` de un `<input type="time">`), combina la
 *    fecha con esa hora local.
 *  - Si no hay hora y la fecha elegida es hoy, usa la hora actual real.
 *  - Si no hay hora y es otra fecha, usa mediodía local (12:00) para no cruzar
 *    de día en ninguna zona horaria al serializar.
 */
export function paymentInputToISO(dateInput: string, timeInput?: string): string {
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput || '')
  if (!m) return now.toISOString()

  const tm = /^(\d{2}):(\d{2})$/.exec(timeInput || '')
  if (tm) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(tm[1]),
      Number(tm[2]),
      0,
    ).toISOString()
  }

  if (dateInput === todayKey) return now.toISOString()
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0).toISOString()
}

/** Todos los pagos del cliente (de todos sus procesos), con fallback al modelo legacy. */
export function getClientPayments(client: Client): Payment[] {
  if (client.processes?.length) {
    return client.processes.flatMap((p) => p.payments ?? [])
  }
  return client.payments ?? []
}

export interface ClientPaymentSummary {
  total: number
  paid: number
  balance: number
  /** Si el cliente tiene algún proceso o dato de pago. */
  hasAny: boolean
}

/**
 * Resume total/pagado/saldo del cliente sumando sus procesos. Si no tiene
 * `processes`, cae al modelo legacy (`payment_total` / `payments`).
 */
export function getClientPaymentSummary(client: Client): ClientPaymentSummary {
  if (client.processes?.length) {
    const total = sumMoney(client.processes.map((p) => p.total))
    const paid = sumMoney(client.processes.map(getProcessPaid))
    return { total, paid, balance: fromCents(toCents(total) - toCents(paid)), hasAny: true }
  }
  const total = client.payment_total ?? 0
  const paid = sumMoney((client.payments ?? []).map((p) => p.amount))
  return {
    total,
    paid,
    balance: fromCents(toCents(total) - toCents(paid)),
    hasAny: total > 0 || paid > 0,
  }
}

/**
 * Un Registro de LLC NO tiene Registered Agent por defecto. Solo cuando el
 * agente lo marca explícitamente como `true` se considera que lo incluye.
 */
export function hasRegisteredAgent(process: ClientProcess): boolean {
  return process.has_registered_agent === true
}

export const PROCESS_STAGE_LABELS: Record<ProcessStage, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completado: 'Completado',
  cancelado: 'Cancelado',
}
