import { Timestamp } from 'firebase/firestore'
import type { Call, Client, ClientStatus, StatusEvent } from '@/types'

// Historial de status del cliente. Las métricas ("cerrados hoy", "meta del
// mes") se calculan con estas fechas y no con `updated_at`: editar una nota de
// un cliente cerrado hace meses ya no lo cuenta como venta de hoy.

const MAX_HISTORY = 50

/** Status que implican que el cliente ya fue contactado. */
const CONTACTED_STATUSES = new Set<ClientStatus>(['contactado', 'en_proceso', 'cerrado', 'deuda_pendiente'])

type StatusFields = Pick<Client, 'status' | 'status_history' | 'contacted_at' | 'closed_at'>
type StatusSource = Pick<Client, 'status'> & Partial<Pick<Client, 'status_history' | 'contacted_at' | 'closed_at'>>

/** Campos de status para un cliente nuevo. */
export function initialStatusFields(
  status: ClientStatus,
  by: string | null,
  at: Timestamp = Timestamp.now(),
): StatusFields {
  return {
    status,
    status_history: [{ from: null, to: status, at, by }],
    contacted_at: CONTACTED_STATUSES.has(status) ? at : null,
    closed_at: status === 'cerrado' ? at : null,
  }
}

/**
 * Campos a escribir cuando el cliente pasa a `to`, o `null` si no cambia.
 * Debe aplicarse sobre el documento actual (dentro de una transacción).
 */
export function statusChangeFields(
  client: StatusSource,
  to: ClientStatus,
  by: string | null,
  at: Timestamp = Timestamp.now(),
): StatusFields | null {
  if (client.status === to) return null
  const event: StatusEvent = { from: client.status, to, at, by }
  const fields: StatusFields = {
    status: to,
    status_history: [...(client.status_history ?? []), event].slice(-MAX_HISTORY),
  }
  if (!client.contacted_at && CONTACTED_STATUSES.has(to)) fields.contacted_at = at
  if (to === 'cerrado') fields.closed_at = at
  else if (client.status === 'cerrado') fields.closed_at = null
  return fields
}

// ── Lectura para métricas ──
// Clientes de antes del historial (sin el campo) caen a `updated_at`, que era
// el criterio anterior, hasta correr `scripts/migrate-status-history.ts`.

export function getClosedAt(client: Client): Date | null {
  if (client.closed_at !== undefined) return client.closed_at?.toDate?.() ?? null
  return client.status === 'cerrado' ? client.updated_at?.toDate?.() ?? null : null
}

export function getContactedAt(client: Client): Date | null {
  if (client.contacted_at !== undefined) return client.contacted_at?.toDate?.() ?? null
  return client.status === 'contactado' ? client.updated_at?.toDate?.() ?? null : null
}

export function countClosed(clients: Client[], inRange: (d: Date) => boolean): number {
  return clients.filter((c) => {
    const d = getClosedAt(c)
    return d ? inRange(d) : false
  }).length
}

/**
 * Clientes distintos con contacto en el rango: los que pasaron a contactado
 * en el rango, más los que tuvieron un intento de contacto o una llamada
 * completada en el rango.
 */
export function countContacted(clients: Client[], calls: Call[], inRange: (d: Date) => boolean): number {
  const ids = new Set<string>()
  for (const c of clients) {
    const d = getContactedAt(c)
    if (d && inRange(d)) ids.add(c.id)
  }
  for (const call of calls) {
    const d = call.scheduled_at?.toDate?.()
    // Las llamadas a leads (spec 19) no cuentan: un lead no es cliente.
    if (call.client_id && call.outcome === 'completada' && d && inRange(d)) ids.add(call.client_id)
  }
  return ids.size
}
