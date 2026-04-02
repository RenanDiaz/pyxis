import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ClientStatus } from '@/types'

const STATUS_CONFIG: Record<ClientStatus, { label: string; className: string }> = {
  nuevo: { label: 'Nuevo', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/30' },
  contactado: { label: 'Contactado', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/30' },
  en_proceso: { label: 'En proceso', className: 'bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/30' },
  cerrado: { label: 'Cerrado', className: 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/30' },
  perdido: { label: 'Perdido', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-gray-800/30 dark:text-gray-400 dark:hover:bg-gray-800/30' },
  deuda_pendiente: { label: 'Deuda pendiente', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/30' },
}

export default function StatusBadge({ status }: { status: ClientStatus }) {
  const config = STATUS_CONFIG[status]
  if (!config) {
    return (
      <Badge variant="secondary" className="bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400">
        Sin estado
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className={cn(config.className)}>
      {config.label}
    </Badge>
  )
}

export { STATUS_CONFIG }
