import { Link } from 'react-router-dom'
import StatusBadge from '@/components/clients/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Archive, Phone, Building2, MapPin, ChevronRight, Users, DollarSign } from 'lucide-react'
import type { Client, WorkspaceMember } from '@/types'
import { getPrimaryPhoneNumber } from '@/lib/clientUtils'

interface ClientsTableProps {
  clients: Client[]
  showAgentColumn?: boolean
  agentsMap?: Map<string, WorkspaceMember>
  showTeamColumn?: boolean
  teamsMap?: Map<string, string>
  linkPrefix?: string
  isLoading?: boolean
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = firstName?.charAt(0)?.toUpperCase() || ''
  const l = lastName?.charAt(0)?.toUpperCase() || ''
  return f + l || '?'
}

function getClientDisplayName(client: Client): string | null {
  return client.first_name || client.last_name
    ? `${client.first_name || ''} ${client.last_name || ''}`.trim()
    : null
}

export default function ClientsTable({
  clients,
  showAgentColumn,
  agentsMap,
  showTeamColumn,
  teamsMap,
  linkPrefix = '/clientes',
  isLoading,
}: ClientsTableProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Users className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">No hay clientes</p>
        <p className="text-sm mt-1">No se encontraron clientes con estos filtros</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {clients.map((client) => {
        const displayName = getClientDisplayName(client)
        const agentName = showAgentColumn && agentsMap
          ? agentsMap.get(client.owner_uid)?.display_name || 'Desconocido'
          : null
        const teamName = showTeamColumn && teamsMap && client.subteam_id
          ? teamsMap.get(client.subteam_id) || 'Sin equipo'
          : showTeamColumn
            ? 'Sin equipo'
            : null

        return (
          <Link key={client.id} to={`${linkPrefix}/${client.id}`} className="group">
            <Card className={`transition-all hover:shadow-md hover:border-primary/30 group-focus-visible:ring-2 group-focus-visible:ring-ring ${client.archived ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {getInitials(client.first_name, client.last_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate leading-tight">
                          {displayName || 'Sin nombre'}
                        </p>
                        {client.llc_name && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{client.llc_name}</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors mt-0.5" />
                    </div>

                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
                      {getPrimaryPhoneNumber(client) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{getPrimaryPhoneNumber(client)}</span>
                        </div>
                      )}
                      {client.state && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{client.state}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center flex-wrap gap-2 mt-2">
                      <StatusBadge status={client.status} />
                      {client.archived && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          <Archive className="h-3 w-3" />
                          Archivado
                        </span>
                      )}
                      {client.payment_total != null && client.payment_total > 0 && (() => {
                        const paid = (client.payments ?? []).reduce((s, p) => s + p.amount, 0)
                        const bal = client.payment_total - paid
                        if (bal <= 0) return (
                          <span className="inline-flex items-center gap-0.5 text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full dark:bg-green-900/30 dark:text-green-300">
                            <DollarSign className="h-3 w-3" /> Pagado
                          </span>
                        )
                        if (paid > 0) return (
                          <span className="inline-flex items-center gap-0.5 text-xs text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full dark:bg-orange-900/30 dark:text-orange-300">
                            <DollarSign className="h-3 w-3" /> Debe ${bal.toLocaleString()}
                          </span>
                        )
                        return (
                          <span className="inline-flex items-center gap-0.5 text-xs text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full dark:bg-red-900/30 dark:text-red-300">
                            <DollarSign className="h-3 w-3" /> Pendiente
                          </span>
                        )
                      })()}
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
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
