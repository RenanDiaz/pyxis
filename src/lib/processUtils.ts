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
