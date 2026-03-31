import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, X, Phone, PhoneOff, Clock, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'
import { usePendingInvitations, useAcceptInvitation, useDeclineInvitation } from '@/hooks/useInvitations'
import { useOverdueCalls, useUpcomingCalls } from '@/hooks/useCalls'
import { useClients } from '@/hooks/useClients'
import { getClientDisplayName } from '@/lib/clientUtils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import type { Call, Client, TeamInvitation } from '@/types'

function InvitationItem({
  invitation,
  onAccepted,
}: {
  invitation: TeamInvitation
  onAccepted: () => void
}) {
  const { user } = useAuth()
  const acceptInvitation = useAcceptInvitation()
  const declineInvitation = useDeclineInvitation()

  const handleAccept = async () => {
    if (!user) return
    try {
      await acceptInvitation.mutateAsync({
        invitationId: invitation.id,
        user: {
          uid: user.uid,
          display_name: user.displayName || user.email || '',
          email: user.email || '',
        },
      })
      toast.success('Te has unido al equipo')
      onAccepted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al aceptar invitación')
    }
  }

  const handleDecline = async () => {
    try {
      await declineInvitation.mutateAsync(invitation.id)
      toast.success('Invitación rechazada')
    } catch {
      toast.error('Error al rechazar invitación')
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
        <Users className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Invitación a equipo</p>
        <p className="text-xs text-muted-foreground truncate">
          {invitation.team_name} — por {invitation.invited_by_name}
        </p>
        <div className="mt-2 flex items-center gap-1">
          <Button
            size="sm"
            variant="default"
            className="h-7 gap-1 text-xs"
            onClick={handleAccept}
            disabled={acceptInvitation.isPending}
          >
            <Check className="h-3 w-3" />
            Aceptar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleDecline}
            disabled={declineInvitation.isPending}
          >
            <X className="h-3 w-3" />
            Rechazar
          </Button>
        </div>
      </div>
    </div>
  )
}

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
  const { user } = useAuth()

  const { data: invitations } = usePendingInvitations(user?.email)
  const { data: overdueCalls } = useOverdueCalls(5)
  const { data: upcomingCalls } = useUpcomingCalls(5)
  const { data: clients } = useClients()

  const invitationCount = invitations?.length ?? 0
  const overdueCount = overdueCalls?.length ?? 0
  const upcomingCount = upcomingCalls?.length ?? 0
  const totalCount = invitationCount + overdueCount + upcomingCount

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
              {/* Invitations */}
              {invitations?.map((inv) => (
                <InvitationItem
                  key={inv.id}
                  invitation={inv}
                  onAccepted={() => {
                    if (invitationCount <= 1 && overdueCount === 0 && upcomingCount === 0) {
                      setOpen(false)
                    }
                  }}
                />
              ))}

              {/* Overdue calls */}
              {overdueCalls?.map((call) => (
                <CallItem
                  key={call.id}
                  call={call}
                  clients={clients ?? []}
                  overdue
                  onClick={() => handleCallClick(call)}
                />
              ))}

              {/* Upcoming calls */}
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
