import { useState, useMemo } from 'react'
import { useClients } from '@/hooks/useClients'
import { useAllUsers } from '@/hooks/useUsers'
import { useTeams } from '@/hooks/useTeams'
import ClientsTable from '@/components/shared/ClientsTable'
import AgentFilter from '@/components/shared/AgentFilter'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Archive, Search } from 'lucide-react'
import type { ClientStatus } from '@/types'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'cerrado', label: 'Cerrado' },
  { value: 'perdido', label: 'Perdido' },
  { value: 'deuda_pendiente', label: 'Deuda pendiente' },
]

export default function AdminClients() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)

  const { data: clients, isLoading } = useClients({
    status: statusFilter !== 'all' ? (statusFilter as ClientStatus) : undefined,
    search: search || undefined,
    archived: showArchived,
  })
  const { data: users } = useAllUsers()
  const { data: teams } = useTeams()

  const agentsMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof users>[number]>()
    users?.forEach((u) => map.set(u.uid, u))
    return map
  }, [users])

  const teamsMap = useMemo(() => {
    const map = new Map<string, string>()
    teams?.forEach((t) => map.set(t.id, t.name))
    return map
  }, [teams])

  const filteredClients = useMemo(() => {
    if (!clients) return []
    let result = clients
    if (agentFilter !== 'all') {
      result = result.filter((c) => c.owner_uid === agentFilter)
    }
    if (teamFilter !== 'all') {
      if (teamFilter === 'none') {
        result = result.filter((c) => !c.team_id)
      } else {
        result = result.filter((c) => c.team_id === teamFilter)
      }
    }
    return result
  }, [clients, agentFilter, teamFilter])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Todos los clientes</h1>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono, LLC o estado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
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
        {users && (
          <AgentFilter
            agents={users}
            value={agentFilter}
            onChange={setAgentFilter}
          />
        )}
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Equipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los equipos</SelectItem>
            <SelectItem value="none">Sin equipo</SelectItem>
            {teams?.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
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

      <ClientsTable
        clients={filteredClients}
        showAgentColumn
        agentsMap={agentsMap}
        showTeamColumn
        teamsMap={teamsMap}
        isLoading={isLoading}
      />
    </div>
  )
}
