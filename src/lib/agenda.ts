import { endOfDay, endOfWeek, startOfDay, startOfWeek } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import type { Call } from '@/types'

// Lógica de la Agenda (spec 08), pura para poder testearla.

export type AgendaView = 'pendientes' | 'hoy' | 'semana' | 'historial'

export const AGENDA_PAGE_SIZE = 50
/** Margen para no advertir por una cita "en el pasado" que es de hace un momento. */
export const PAST_MARGIN_MS = 5 * 60 * 1000

/** Los intentos de contacto (spec 05) son registros, no citas: no van en la Agenda. */
export function isContactAttempt(call: Pick<Call, 'kind'>): boolean {
  return call.kind === 'contact_attempt'
}

const time = (c: Call) => c.scheduled_at?.toMillis?.() ?? 0

/**
 * Llamadas de una vista de la Agenda, ya ordenadas:
 * - pendientes: todas las pendientes, de la más vieja (vencidas primero) a la más nueva;
 * - hoy / semana: todas las del rango, en orden cronológico;
 * - historial: las ya resueltas (no pendientes), de la más reciente a la más vieja.
 */
export function filterAgenda(calls: Call[], view: AgendaView, now: Date = new Date()): Call[] {
  const scheduled = calls.filter((c) => !isContactAttempt(c))
  const asc = (list: Call[]) => [...list].sort((a, b) => time(a) - time(b))
  const inRange = (from: Date, to: Date) =>
    scheduled.filter((c) => time(c) >= from.getTime() && time(c) <= to.getTime())
  switch (view) {
    case 'pendientes':
      return asc(scheduled.filter((c) => c.outcome === 'pendiente'))
    case 'hoy':
      return asc(inRange(startOfDay(now), endOfDay(now)))
    case 'semana':
      return asc(inRange(startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })))
    case 'historial':
      return [...scheduled.filter((c) => c.outcome !== 'pendiente')].sort((a, b) => time(b) - time(a))
  }
}

export function isOverdue(call: Call, now: Date = new Date()): boolean {
  return call.outcome === 'pendiente' && time(call) < now.getTime()
}

/**
 * Fecha y hora capturadas en el formulario → instante real. Con `timeZone`
 * (la zona del cliente) se interpretan como hora del cliente; sin ella, como
 * hora local del agente.
 */
export function scheduledInstant(date: string, time: string, timeZone?: string | null): Date {
  const local = `${date}T${time}`
  return timeZone ? fromZonedTime(local, timeZone) : new Date(local)
}

/** Si la cita quedaría en el pasado (con margen de 5 minutos). */
export function isInPast(at: Date, now: Date = new Date()): boolean {
  return at.getTime() < now.getTime() - PAST_MARGIN_MS
}
