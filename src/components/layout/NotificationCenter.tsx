import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Phone, PhoneOff, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { useOverdueCalls, useUpcomingCalls } from '@/hooks/useCalls'
import { useClients } from '@/hooks/useClients'
import { getClientDisplayName } from '@/lib/clientUtils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Call, Client } from '@/types'

function CallItem({
  call,
  clients,
  overdue,
  onClick,
}: {
  call: Call
  clients: Client[]
  overdue?: boolean
  onClick: () => void
}) {
  const client = clients.find((c) => c.id === call.client_id)
  const clientName = client ? getClientDisplayName(client) : 'Cliente'
  const scheduledAt = call.scheduled_at?.toDate?.()
  const timeAgo = scheduledAt
    ? formatDistanceToNow(scheduledAt, { addSuffix: true, locale: es })
    : ''

  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          overdue
            ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
        }`}
      >
        {overdue ? <PhoneOff className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {overdue ? 'Llamada vencida' : 'Llamada próxima'}
        </p>
        <p className="text-xs text-muted-foreground truncate">{clientName}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </p>
      </div>
    </button>
  )
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const { data: overdueCalls } = useOverdueCalls(5)
  const { data: upcomingCalls } = useUpcomingCalls(5)
  const { data: clients } = useClients()

  const overdueCount = overdueCalls?.length ?? 0
  const upcomingCount = upcomingCalls?.length ?? 0
  const totalCount = overdueCount + upcomingCount

  const handleCallClick = (call: Call) => {
    setOpen(false)
    navigate(`/clientes/${call.client_id}`)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {totalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {totalCount > 9 ? '9+' : totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notificaciones</h3>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {totalCount === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay notificaciones
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {overdueCalls?.map((call) => (
                <CallItem
                  key={call.id}
                  call={call}
                  clients={clients ?? []}
                  overdue
                  onClick={() => handleCallClick(call)}
                />
              ))}

              {upcomingCalls?.map((call) => (
                <CallItem
                  key={call.id}
                  call={call}
                  clients={clients ?? []}
                  onClick={() => handleCallClick(call)}
                />
              ))}
            </div>
          )}
        </div>

        {(overdueCount > 0 || upcomingCount > 0) && (
          <div className="border-t px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setOpen(false)
                navigate('/agenda')
              }}
            >
              Ver toda la agenda
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
