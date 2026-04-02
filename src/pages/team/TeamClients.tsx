import { useState, useMemo } from 'react'
import { useClients } from '@/hooks/useClients'
import { useTeamMembers } from '@/hooks/useUsers'
import { useTeamContext } from '@/contexts/TeamContext'
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
import { Search } from 'lucide-react'
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

export default function TeamClients() {
  const { activeTeamId } = useTeamContext()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [agentFilter, setAgentFilter] = useState('all')

  const { data: clients, isLoading } = useClients({
    status: statusFilter !== 'all' ? (statusFilter as ClientStatus) : undefined,
    search: search || undefined,
  })
  const { data: members } = useTeamMembers(activeTeamId)

  const agentsMap = useMemo(() => {
    const map = new Map<string, typeof members extends (infer U)[] | undefined ? NonNullable<U> : never>()
    members?.forEach((m) => map.set(m.uid, m))
    return map
  }, [members])

  const filteredClients = useMemo(() => {
    if (!clients) return []
    if (agentFilter === 'all') return clients
    return clients.filter((c) => c.owner_uid === agentFilter)
  }, [clients, agentFilter])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Clientes del equipo</h1>

      <div className="flex flex-col sm:flex-row gap-3">
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
        {members && (
          <AgentFilter
            agents={members}
            value={agentFilter}
            onChange={setAgentFilter}
          />
        )}
      </div>

      <ClientsTable
        clients={filteredClients}
        showAgentColumn
        agentsMap={agentsMap}
        isLoading={isLoading}
      />
    </div>
  )
}
