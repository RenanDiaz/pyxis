import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'

/** Ventana horaria (hora local del cliente) considerada buena para llamar. */
const GOOD_CALL_START = 9
const GOOD_CALL_END = 20

/**
 * ¿Es buena hora para llamar según la hora local del cliente?
 * Verdadero entre las 9:00 y las 20:00 en la zona horaria dada.
 */
export function isGoodCallTime(date: Date, timezone: string): boolean {
  try {
    const hour = Number(formatInTimeZone(date, timezone, 'H'))
    return hour >= GOOD_CALL_START && hour < GOOD_CALL_END
  } catch {
    return true
  }
}

/** Etiqueta del semáforo de horario. */
export function getCallTimeLabel(date: Date, timezone: string): string {
  return isGoodCallTime(date, timezone) ? 'Buena hora para llamar' : 'Fuera de horario'
}

/** Hora local formateada en la zona horaria dada (ej. "2:30 PM"). */
export function formatLocalTime(date: Date, timezone: string, pattern = 'h:mm a'): string {
  try {
    return formatInTimeZone(date, timezone, pattern, { locale: es })
  } catch {
    return '—'
  }
}
