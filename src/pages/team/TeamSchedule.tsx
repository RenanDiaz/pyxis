import { useState, useMemo } from 'react'
import { useCalls, useUpdateCall } from '@/hooks/useCalls'
import { useClients } from '@/hooks/useClients'
import { useTeamMembers } from '@/hooks/useUsers'
import { useTeamContext } from '@/contexts/TeamContext'
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

export default function TeamSchedule() {
  const { activeTeamId } = useTeamContext()
  const [tab, setTab] = useState<FilterTab>('todas')
  const [agentFilter, setAgentFilter] = useState('all')
  const [outcomeFilter, setOutcomeFilter] = useState('all')

  const dateFilters = getDateFilters(tab)
  const { data: calls, isLoading: loadingCalls } = useCalls({
    ...dateFilters,
    outcome: tab === 'pendientes' ? 'pendiente' : outcomeFilter !== 'all' ? (outcomeFilter as CallOutcome) : undefined,
  })
  const { data: clients } = useClients()
  const { data: members } = useTeamMembers(activeTeamId)
  const updateCallMutation = useUpdateCall()

  const agentsMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof members>[number]>()
    members?.forEach((m) => map.set(m.uid, m))
    return map
  }, [members])

  const filteredCalls = useMemo(() => {
    if (!calls) return []
    if (agentFilter === 'all') return calls
    return calls.filter((c) => c.owner_uid === agentFilter)
  }, [calls, agentFilter])

  const handleOutcomeChange = async (callId: string, outcome: CallOutcome) => {
    await updateCallMutation.mutateAsync({ id: callId, data: { outcome } })
    toast.success('Llamada actualizada')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Agenda del equipo</h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
          <TabsTrigger value="hoy">Hoy</TabsTrigger>
          <TabsTrigger value="semana">Esta semana</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-3">
        {members && (
          <AgentFilter
            agents={members}
            value={agentFilter}
            onChange={setAgentFilter}
          />
        )}
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="w-[170px]">
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
      </div>

      <CallsList
        calls={filteredCalls}
        clients={clients ?? []}
        showAgentColumn
        agentsMap={agentsMap}
        isLoading={loadingCalls}
        onOutcomeChange={handleOutcomeChange}
      />
    </div>
  )
}
