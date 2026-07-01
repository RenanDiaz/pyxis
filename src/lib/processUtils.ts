import type { StateInfo, Client, ClientProcess, ProcessStage, Payment } from '@/types'
import { PROCESSES } from '@/data/processes'

export function getProcessDef(type: string) {
  return PROCESSES.find((p) => p.id === type)
}

export function getProcessLabel(type: string): string {
  return getProcessDef(type)?.label ?? type
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
  return (process.payments ?? []).reduce((sum, p) => sum + p.amount, 0)
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
    let total = 0
    let paid = 0
    for (const p of client.processes) {
      total += p.total ?? 0
      paid += getProcessPaid(p)
    }
    return { total, paid, balance: total - paid, hasAny: true }
  }
  const total = client.payment_total ?? 0
  const paid = (client.payments ?? []).reduce((s, p) => s + p.amount, 0)
  return {
    total,
    paid,
    balance: total - paid,
    hasAny: total > 0 || paid > 0,
  }
}

/**
 * Un Registro de LLC tiene Registered Agent por defecto. Solo cuando el agente
 * lo marca explícitamente como `false` se considera que no lo incluye.
 */
export function hasRegisteredAgent(process: ClientProcess): boolean {
  return process.has_registered_agent !== false
}

export const PROCESS_STAGE_LABELS: Record<ProcessStage, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completado: 'Completado',
  cancelado: 'Cancelado',
}
