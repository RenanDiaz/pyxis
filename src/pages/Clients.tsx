import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useClients } from '@/hooks/useClients'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useWorkspaceMembers } from '@/hooks/useWorkspace'
import StatusBadge from '@/components/clients/StatusBadge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Archive, Search, Plus, Phone, Building2, MapPin, ChevronRight, Users, UserCircle } from 'lucide-react'
import type { ClientStatus, WorkspaceMember } from '@/types'
import { getPrimaryPhoneNumber } from '@/lib/clientUtils'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'cerrado', label: 'Cerrado' },
  { value: 'perdido', label: 'Perdido' },
  { value: 'deuda_pendiente', label: 'Deuda pendiente' },
]

function getInitials(firstName?: string, lastName?: string): string {
  const f = firstName?.charAt(0)?.toUpperCase() || ''
  const l = lastName?.charAt(0)?.toUpperCase() || ''
  return f + l || '?'
}

export default function Clients() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const { role, workspaceId } = useUserProfile()

  const showAgent = role === 'owner' || role === 'supervisor'
  const { data: members } = useWorkspaceMembers(showAgent ? workspaceId : null)
  const agentsMap = useMemo(() => {
    if (!members) return new Map<string, WorkspaceMember>()
    const map = new Map<string, WorkspaceMember>()
    for (const m of members) map.set(m.uid, m)
    return map
  }, [members])

  const { data: clients, isLoading } = useClients({
    status: statusFilter !== 'all' ? (statusFilter as ClientStatus) : undefined,
    search: search || undefined,
    archived: showArchived,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <Button asChild>
          <Link to="/clientes/nuevo">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo cliente
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono, LLC o estado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
          <Label htmlFor="show-archived" className="text-sm cursor-pointer whitespace-nowrap">
            Mostrar archivados
          </Label>
        </div>
      </div>

      {showArchived && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <Archive className="h-4 w-4 shrink-0" />
          Estás viendo clientes archivados
        </div>
      )}

      {isLoading ? (
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
      ) : !clients || clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No hay clientes aún</p>
          <p className="text-sm mt-1">Comienza agregando tu primer cliente</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/clientes/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Crear el primero
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => {
            const displayName =
              client.first_name || client.last_name
                ? `${client.first_name || ''} ${client.last_name || ''}`.trim()
                : null

            return (
              <Link key={client.id} to={`/clientes/${client.id}`} className="group">
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
                          {showAgent && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              <UserCircle className="h-3 w-3" />
                              {agentsMap.get(client.owner_uid)?.display_name || 'Desconocido'}
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
      )}
    </div>
  )
}
