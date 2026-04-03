import { Link } from 'react-router-dom'
import StatusBadge from '@/components/clients/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Archive, Phone, Building2, MapPin, ChevronRight, Users, DollarSign, Mail } from 'lucide-react'
import type { Client, WorkspaceMember } from '@/types'
import { getPrimaryPhoneNumber } from '@/lib/clientUtils'
import { formatPhoneForWhatsApp } from '@/lib/phoneUtils'

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

                    {(getPrimaryPhoneNumber(client) || client.email) && (
                      <div className="flex items-center gap-1.5 mt-2">
                        {getPrimaryPhoneNumber(client) && (() => {
                          const whatsapp = formatPhoneForWhatsApp(getPrimaryPhoneNumber(client)!)
                          return whatsapp ? (
                            <a
                              href={`https://wa.me/${whatsapp}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#25D366] text-white hover:bg-[#1da851] transition-colors"
                              title="WhatsApp"
                            >
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                            </a>
                          ) : null
                        })()}
                        {getPrimaryPhoneNumber(client) && (
                          <a
                            href={`tel:${getPrimaryPhoneNumber(client)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            title="Llamar"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {client.email && (
                          <a
                            href={`mailto:${client.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                            title="Email"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    )}

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
