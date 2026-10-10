import type { Call } from '@/types'

// Avisos de llamadas (spec 21): 5 minutos antes y a la hora. Lógica pura.

export type ReminderKind = 'before' | 'now'

const MINUTE = 60_000
/** Antelación del primer aviso. */
export const REMINDER_LEAD_MS = 5 * MINUTE
/** Un aviso atrasado (equipo dormido, pestaña congelada) solo sale dentro de este margen. */
export const REMINDER_GRACE_MS = 10 * MINUTE

export interface DueReminder {
  call: Call
  kind: ReminderKind
  /** Identifica el aviso; incluye la hora, así que un reagendado avisa de nuevo. */
  key: string
  fireAt: number
}

export function reminderKey(callId: string, kind: ReminderKind, scheduledMs: number): string {
  return `${callId}:${kind}:${scheduledMs}`
}

/**
 * Avisos que tocan ahora: llamadas pendientes propias cuya hora de aviso ya
 * llegó, dentro del margen de gracia, y que no se avisaron todavía.
 */
export function dueReminders(
  calls: Call[],
  uid: string,
  now: number,
  alreadyFired: (key: string) => boolean,
): DueReminder[] {
  const due: DueReminder[] = []
  for (const call of calls) {
    if (call.owner_uid !== uid || call.outcome !== 'pendiente' || call.kind === 'contact_attempt') continue
    const scheduledMs = call.scheduled_at?.toMillis?.()
    if (scheduledMs == null) continue
    const points: [ReminderKind, number][] = [
      ['before', scheduledMs - REMINDER_LEAD_MS],
      ['now', scheduledMs],
    ]
    for (const [kind, fireAt] of points) {
      if (fireAt > now || now - fireAt > REMINDER_GRACE_MS) continue
      // Pasada la hora de la llamada, "en 5 minutos" ya no tiene sentido,
      // aunque "es la hora" se haya mostrado antes (otra pestaña, recarga).
      if (kind === 'before' && now >= scheduledMs) continue
      const key = reminderKey(call.id, kind, scheduledMs)
      if (!alreadyFired(key)) due.push({ call, kind, key, fireAt })
    }
  }
  return due
}

/** Ventana de llamadas que hay que tener cargadas para avisar a tiempo. */
export function reminderWindow(now: number): { from: Date; to: Date } {
  return { from: new Date(now - REMINDER_GRACE_MS), to: new Date(now + 60 * MINUTE) }
}
