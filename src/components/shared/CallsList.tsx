import { Link } from 'react-router-dom'
import { OUTCOME_CONFIG } from '@/components/calls/OutcomeBadge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Phone, Clock } from 'lucide-react'
import { getStateTimezone, getTimezoneLabel } from '@/lib/timezones'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import type { Call, CallOutcome, Client, UserProfile } from '@/types'

interface CallsListProps {
  calls: Call[]
  clients: Client[]
  showAgentColumn?: boolean
  agentsMap?: Map<string, UserProfile>
  showTeamColumn?: boolean
  teamsMap?: Map<string, string>
  isLoading?: boolean
  onOutcomeChange: (callId: string, outcome: CallOutcome) => void
}

function getClientName(clients: Client[], clientId: string): string {
  const client = clients.find((c) => c.id === clientId)
  if (!client) return 'Cliente desconocido'
  return client.first_name || client.last_name
    ? `${client.first_name || ''} ${client.last_name || ''}`.trim()
    : client.phone
}

export default function CallsList({
  calls,
  clients,
  showAgentColumn,
  agentsMap,
  showTeamColumn,
  teamsMap,
  isLoading,
  onOutcomeChange,
}: CallsListProps) {
  if (isLoading) {
    return <p className="text-muted-foreground">Cargando llamadas...</p>
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Phone className="mx-auto h-8 w-8 mb-2" />
        <p>No hay llamadas</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {calls.map((call) => {
        const agentName = showAgentColumn && agentsMap
          ? agentsMap.get(call.owner_uid)?.display_name || 'Desconocido'
          : null
        const teamName = showTeamColumn && teamsMap && call.team_id
          ? teamsMap.get(call.team_id) || 'Sin equipo'
          : showTeamColumn
            ? 'Sin equipo'
            : null

        return (
          <Card key={call.id}>
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/clientes/${call.client_id}`}
                    className="font-medium hover:underline"
                  >
                    {getClientName(clients, call.client_id)}
                  </Link>
                  {agentName && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {agentName}
                    </span>
                  )}
                  {teamName && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {teamName}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {call.scheduled_at?.toDate?.()?.toLocaleString('es-MX', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }) ?? 'Sin fecha'}
                </p>
                {(() => {
                  const client = clients.find((c) => c.id === call.client_id)
                  const scheduledDate = call.scheduled_at?.toDate?.()
                  if (!client?.state || !scheduledDate) return null
                  const tz = getStateTimezone(client.state)
                  const clientTime = formatInTimeZone(scheduledDate, tz, 'h:mm a', { locale: es })
                  const label = getTimezoneLabel(tz)
                  return (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {clientTime} ({label}) — hora del cliente
                    </p>
                  )
                })()}
                {call.notes && (
                  <p className="text-sm text-muted-foreground mt-1">{call.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={call.outcome}
                  onValueChange={(v) => onOutcomeChange(call.id, v as CallOutcome)}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(OUTCOME_CONFIG) as CallOutcome[]).map((o) => (
                      <SelectItem key={o} value={o}>
                        {OUTCOME_CONFIG[o].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
