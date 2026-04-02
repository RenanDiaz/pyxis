import type { ClientStatus } from '@/types'

export type StatusTrigger = 'info_added' | 'document_uploaded' | 'partial_payment' | 'full_payment'

/**
 * Status priority order (lower index = less advanced).
 * Automatic transitions only move forward, never backward.
 */
const STATUS_ORDER: ClientStatus[] = [
  'nuevo',
  'contactado',
  'en_proceso',
  'cerrado',
  'perdido',
  'deuda_pendiente',
]

function statusIndex(status: ClientStatus): number {
  return STATUS_ORDER.indexOf(status)
}

/**
 * Given the current client status and a trigger event, returns the new
 * status if an automatic transition applies, or `null` if no change.
 */
export function inferStatus(
  currentStatus: ClientStatus,
  trigger: StatusTrigger
): ClientStatus | null {
  switch (trigger) {
    case 'info_added':
    case 'document_uploaded': {
      // nuevo → contactado (only if not already more advanced)
      if (currentStatus === 'nuevo') return 'contactado'
      return null
    }

    case 'partial_payment': {
      // nuevo | contactado → en_proceso
      // no change if already cerrado, perdido, or deuda_pendiente
      if (currentStatus === 'nuevo' || currentStatus === 'contactado') {
        return 'en_proceso'
      }
      return null
    }

    case 'full_payment': {
      // any → cerrado, except perdido and deuda_pendiente (require manual change)
      if (currentStatus === 'perdido' || currentStatus === 'deuda_pendiente') {
        return null
      }
      if (currentStatus === 'cerrado') return null
      return 'cerrado'
    }

    default:
      return null
  }
}
