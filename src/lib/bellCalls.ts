import type { Call, Client } from '@/types'
import { isLeadCall } from '@/lib/leads'

// Qué llamadas avisa la campana (spec 20).

/** Las vencidas más viejas que esto ya no son notificación: viven en la Agenda. */
export const BELL_WINDOW_DAYS = 14

export function bellWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - BELL_WINDOW_DAYS * 24 * 60 * 60 * 1000)
}

/**
 * ¿Esta llamada debe avisar? Las de leads sí. Las de clientes solo si el
 * cliente existe, no está archivado y no está perdido (P2): esas siguen en la
 * Agenda, pero no reclaman atención.
 */
export function shouldNotify(call: Call, clientsById: Map<string, Client>): boolean {
  if (isLeadCall(call)) return true
  const client = call.client_id ? clientsById.get(call.client_id) : undefined
  return !!client && !client.archived && client.status !== 'perdido'
}

export function selectBellCalls(calls: Call[], clientsById: Map<string, Client>, max: number): Call[] {
  return calls.filter((c) => shouldNotify(c, clientsById)).slice(0, max)
}
