import { useState, useMemo } from 'react'
import { useCalls, useUpdateCall } from '@/hooks/useCalls'
import { useClients } from '@/hooks/useClients'
import { useAllUsers } from '@/hooks/useUsers'
import { useTeams } from '@/hooks/useTeams'
import CallsList from '@/components/shared/CallsList'
import AgentFilter from '@/components/shared/AgentFilter'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { OUTCOME_CONFIG } from '@/components/calls/OutcomeBadge'
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns'
import { toast } from 'sonner'
import type { CallOutcome } from '@/types'

type FilterTab = 'todas' | 'pendientes' | 'hoy' | 'semana'

function getDateFilters(tab: FilterTab) {
  const now = new Date()
  switch (tab) {
    case 'hoy':
      return { fromDate: startOfDay(now), toDate: endOfDay(now) }
    case 'semana':
      return { fromDate: startOfWeek(now, { weekStartsOn: 1 }), toDate: endOfWeek(now, { weekStartsOn: 1 }) }
    default:
      return {}
  }
}

export default function AdminSchedule() {
  const [tab, setTab] = useState<FilterTab>('todas')
  const [agentFilter, setAgentFilter] = useState('all')
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')

  const dateFilters = getDateFilters(tab)
  const { data: calls, isLoading: loadingCalls } = useCalls({
    ...dateFilters,
    outcome: tab === 'pendientes' ? 'pendiente' : outcomeFilter !== 'all' ? (outcomeFilter as CallOutcome) : undefined,
  })
  const { data: clients } = useClients()
  const { data: users } = useAllUsers()
  const { data: teams } = useTeams()
  const updateCallMutation = useUpdateCall()

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

  const filteredCalls = useMemo(() => {
    if (!calls) return []
    let result = calls
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
  }, [calls, agentFilter, teamFilter])

  const handleOutcomeChange = async (callId: string, outcome: CallOutcome) => {
    await updateCallMutation.mutateAsync({ id: callId, data: { outcome } })
    toast.success('Llamada actualizada')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Agenda global</h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
          <TabsTrigger value="hoy">Hoy</TabsTrigger>
          <TabsTrigger value="semana">Esta semana</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        {users && (
          <AgentFilter
            agents={users}
            value={agentFilter}
            onChange={setAgentFilter}
          />
        )}
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue placeholder="Resultado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(Object.keys(OUTCOME_CONFIG) as CallOutcome[]).map((o) => (
              <SelectItem key={o} value={o}>
                {OUTCOME_CONFIG[o].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
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
      </div>

      <CallsList
        calls={filteredCalls}
        clients={clients ?? []}
        showAgentColumn
        agentsMap={agentsMap}
        showTeamColumn
        teamsMap={teamsMap}
        isLoading={loadingCalls}
        onOutcomeChange={handleOutcomeChange}
      />
    </div>
  )
}
