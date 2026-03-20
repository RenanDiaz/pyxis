import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ClientStatus } from '@/types'

const STATUS_CONFIG: Record<ClientStatus, { label: string; className: string }> = {
  nuevo: { label: 'Nuevo', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  contactado: { label: 'Contactado', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
  en_proceso: { label: 'En proceso', className: 'bg-orange-100 text-orange-800 hover:bg-orange-100' },
  cerrado: { label: 'Cerrado', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  perdido: { label: 'Perdido', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
}

export default function StatusBadge({ status }: { status: ClientStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant="secondary" className={cn(config.className)}>
      {config.label}
    </Badge>
  )
}

export { STATUS_CONFIG }
