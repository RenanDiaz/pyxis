import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Phone, PhoneOff, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { useOlderOverdueCount, useOverdueCalls, useUpcomingCalls, useUpdateCall } from '@/hooks/useCalls'
import { useClients } from '@/hooks/useClients'
import { getCallDisplayName, isLeadCall } from '@/lib/leads'
import { BELL_WINDOW_DAYS, selectBellCalls } from '@/lib/bellCalls'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Call, CallOutcome, Client } from '@/types'

/** Cuántas de cada tipo muestra la campana. */
const BELL_MAX = 5

function CallItem({
  call,
  clientsById,
  overdue,
  onOpen,
  onResolve,
  resolving,
}: {
  call: Call
  clientsById: Map<string, Client>
  overdue?: boolean
  onOpen: () => void
  /** Solo vencidas: resolver sin salir de la campana (spec 20). */
  onResolve?: (outcome: CallOutcome) => void
  resolving?: boolean
}) {
  const name = getCallDisplayName(call, clientsById) + (isLeadCall(call) ? ' (lead)' : '')
  const scheduledAt = call.scheduled_at?.toDate?.()
  const timeAgo = scheduledAt
    ? formatDistanceToNow(scheduledAt, { addSuffix: true, locale: es })
    : ''

  return (
    <div className="rounded-lg border">
      <button
        onClick={onOpen}
        className="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent"
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
          <p className="text-xs text-muted-foreground truncate">{name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {timeAgo}
          </p>
        </div>
      </button>
      {onResolve && (
        <div className="flex gap-1 border-t px-2 py-1.5" aria-label={`Resolver llamada con ${name}`}>
          <Button variant="ghost" size="sm" className="h-7 flex-1 text-xs" disabled={resolving} onClick={() => onResolve('completada')}>
            Completada
          </Button>
          <Button variant="ghost" size="sm" className="h-7 flex-1 text-xs" disabled={resolving} onClick={() => onResolve('no_contesto')}>
            No contestó
          </Button>
          <Button variant="ghost" size="sm" className="h-7 flex-1 text-xs" disabled={resolving} onClick={() => onResolve('reagendada')}>
            Reagendar
          </Button>
        </div>
      )}
    </div>
  )
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  // Se piden de más porque las de clientes archivados o perdidos no avisan.
  const { data: overdueRaw } = useOverdueCalls(BELL_MAX * 4)
  const { data: upcomingRaw } = useUpcomingCalls(BELL_MAX * 2)
  const { data: olderOverdue = 0 } = useOlderOverdueCount()
  const { data: activeClients } = useClients()
  // El nombre también para clientes archivados (antes salía "Cliente").
  const { data: archivedClients } = useClients({ archived: true })
  const clientsById = useMemo(() => {
    const map = new Map<string, Client>()
    for (const c of [...(activeClients ?? []), ...(archivedClients ?? [])]) map.set(c.id, c)
    return map
  }, [activeClients, archivedClients])

  const overdueCalls = selectBellCalls(overdueRaw ?? [], clientsById, BELL_MAX)
  const upcomingCalls = selectBellCalls(upcomingRaw ?? [], clientsById, BELL_MAX)
  const totalCount = overdueCalls.length + upcomingCalls.length

  const updateCall = useUpdateCall()
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const handleOpen = (call: Call) => {
    setOpen(false)
    // Un lead no tiene ficha: se gestiona desde la Agenda (spec 19).
    navigate(call.client_id ? `/clientes/${call.client_id}` : '/agenda')
  }

  const handleResolve = async (call: Call, outcome: CallOutcome) => {
    setResolvingId(call.id)
    try {
      await updateCall.mutateAsync({ id: call.id, data: { outcome } })
      if (outcome === 'reagendada') {
        // Abre el modal de la Agenda con el cliente o el lead precargado.
        setOpen(false)
        if (call.client_id) {
          navigate(`/agenda?client=${call.client_id}`)
        } else if (isLeadCall(call)) {
          const params = new URLSearchParams({ lead_name: call.lead.name, lead_phone: call.lead.phone })
          if (call.lead.state) params.set('lead_state', call.lead.state)
          navigate(`/agenda?${params}`)
        }
      } else {
        toast.success('Llamada actualizada')
      }
    } catch {
      // El toast de error lo muestra el handler global de mutaciones.
    } finally {
      setResolvingId(null)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label={totalCount > 0 ? `Notificaciones (${totalCount} pendientes)` : 'Notificaciones'}
        >
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
              {overdueCalls.map((call) => (
                <CallItem
                  key={call.id}
                  call={call}
                  clientsById={clientsById}
                  overdue
                  onOpen={() => handleOpen(call)}
                  onResolve={(outcome) => handleResolve(call, outcome)}
                  resolving={resolvingId === call.id}
                />
              ))}

              {upcomingCalls.map((call) => (
                <CallItem
                  key={call.id}
                  call={call}
                  clientsById={clientsById}
                  onOpen={() => handleOpen(call)}
                />
              ))}
            </div>
          )}
          {olderOverdue > 0 && (
            <p className="px-4 pb-3 text-xs text-muted-foreground">
              Y {olderOverdue} vencida(s) de hace más de {BELL_WINDOW_DAYS} días: están en la Agenda → Pendientes.
            </p>
          )}
        </div>

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
      </PopoverContent>
    </Popover>
  )
}
