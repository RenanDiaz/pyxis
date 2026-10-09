import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, CircleDollarSign, Loader, PhoneCall, Sparkles, XCircle, HelpCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ClientStatus } from '@/types'

// Colores semafóricos (CLAUDE.md) + un ícono por status: el color solo no
// basta para distinguir amarillo/naranja ni para daltónicos (spec 13).
// `deuda_pendiente` pasó de ámbar (casi igual a contactado/en proceso) a violeta.
const STATUS_CONFIG: Record<ClientStatus, { label: string; className: string; icon: LucideIcon }> = {
  nuevo: { label: 'Nuevo', icon: Sparkles, className: 'bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/40' },
  contactado: { label: 'Contactado', icon: PhoneCall, className: 'bg-yellow-100 text-yellow-900 hover:bg-yellow-100 dark:bg-yellow-500/20 dark:text-yellow-200 dark:hover:bg-yellow-500/20' },
  en_proceso: { label: 'En proceso', icon: Loader, className: 'bg-orange-200 text-orange-900 hover:bg-orange-200 dark:bg-orange-600/30 dark:text-orange-200 dark:hover:bg-orange-600/30' },
  cerrado: { label: 'Cerrado', icon: CheckCircle2, className: 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/40' },
  perdido: { label: 'Perdido', icon: XCircle, className: 'bg-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-800/50' },
  deuda_pendiente: { label: 'Deuda pendiente', icon: CircleDollarSign, className: 'bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-900/40 dark:text-violet-300 dark:hover:bg-violet-900/40' },
}

/** Contenido del badge (ícono + texto), reutilizado por `StatusSelect`. */
export function StatusLabel({ status }: { status: ClientStatus }) {
  const config = STATUS_CONFIG[status]
  const Icon = config?.icon ?? HelpCircle
  return (
    <>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {config?.label ?? 'Sin estado'}
    </>
  )
}

export default function StatusBadge({ status }: { status: ClientStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge
      variant="secondary"
      className={cn(
        'gap-1',
        config?.className ?? 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400'
      )}
    >
      <StatusLabel status={status} />
    </Badge>
  )
}

export { STATUS_CONFIG }
