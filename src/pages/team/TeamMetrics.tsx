import { useState } from 'react'
import { format } from 'date-fns'
import { useClients } from '@/hooks/useClients'
import { useCalls } from '@/hooks/useCalls'
import { useTeamMembers } from '@/hooks/useUsers'
import { useTeamContext } from '@/contexts/TeamContext'
import { useTeamGoalsForPeriod } from '@/hooks/useGoals'
import GoalModal from '@/components/goals/GoalModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Phone, BarChart3, Trophy, Target, Plus } from 'lucide-react'
import { startOfDay, endOfDay } from 'date-fns'
import type { ClientStatus } from '@/types'

const STATUS_LABELS: Record<ClientStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  en_proceso: 'En proceso',
  cerrado: 'Cerrado',
  perdido: 'Perdido',
  deuda_pendiente: 'Deuda pendiente',
}

const STATUS_COLORS: Record<ClientStatus, string> = {
  nuevo: 'bg-blue-500',
  contactado: 'bg-yellow-500',
  en_proceso: 'bg-orange-500',
  cerrado: 'bg-green-500',
  perdido: 'bg-gray-400',
  deuda_pendiente: 'bg-amber-600',
}

export default function TeamMetrics() {
  const { activeTeamId } = useTeamContext()
  const { data: clients, isLoading: loadingClients } = useClients()
  const { data: members } = useTeamMembers(activeTeamId)

  const now = new Date()
  const { data: todayCalls, isLoading: loadingCalls } = useCalls({
    fromDate: startOfDay(now),
    toDate: endOfDay(now),
  })

  const monthlyPeriod = format(now, 'yyyy-MM')
  const { data: teamGoals } = useTeamGoalsForPeriod(activeTeamId, 'monthly', monthlyPeriod)

  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [goalTargetUid, setGoalTargetUid] = useState<string | null>(null)
  const [goalTargetName, setGoalTargetName] = useState<string>('')

  const totalClients = clients?.length ?? 0
  const totalCallsToday = todayCalls?.length ?? 0

  // Status breakdown
  const statusBreakdown = (clients ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {})

  // Agent with most clients
  const clientsByAgent = (clients ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.owner_uid] = (acc[c.owner_uid] || 0) + 1
    return acc
  }, {})
  const topAgentUid = Object.entries(clientsByAgent).sort((a, b) => b[1] - a[1])[0]?.[0]
  const topAgent = members?.find((m) => m.uid === topAgentUid)
  const topAgentCount = topAgentUid ? clientsByAgent[topAgentUid] : 0

  // Monthly closed by agent
  const closedByAgent = (clients ?? []).reduce<Record<string, number>>((acc, c) => {
    if (c.status !== 'cerrado') return acc
    const d = c.updated_at?.toDate?.()
    if (!d) return acc
    const m = format(d, 'yyyy-MM')
    if (m !== monthlyPeriod) return acc
    acc[c.owner_uid] = (acc[c.owner_uid] || 0) + 1
    return acc
  }, {})

  // Build a map of latest goal per agent (by precedence: most recent created_at)
  const goalByAgent = (teamGoals ?? []).reduce<Record<string, number>>((acc, g) => {
    // Goals are already ordered by created_at desc, so first one per agent wins
    if (!(g.target_uid in acc)) {
      acc[g.target_uid] = g.value
    }
    return acc
  }, {})

  const openGoalModal = (uid: string, name: string) => {
    setGoalTargetUid(uid)
    setGoalTargetName(name)
    setGoalModalOpen(true)
  }

  const isLoading = loadingClients || loadingCalls

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Métricas del equipo</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de clientes
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : totalClients}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Llamadas de hoy
            </CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : totalCallsToday}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agentes en el equipo
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {members?.length ?? '...'}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agente con más clientes
            </CardTitle>
            <Trophy className="h-4 w-4 shrink-0 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1 text-2xl font-bold">
              {isLoading
                ? '...'
                : topAgent
                  ? <>
                      <span className="truncate">{topAgent.display_name}</span>
                      <span className="shrink-0">({topAgentCount})</span>
                    </>
                  : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team goals */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Metas del mes — {monthlyPeriod}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!members || members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay miembros en el equipo</p>
          ) : (
            <div className="space-y-4">
              {members.map((member) => {
                const closed = closedByAgent[member.uid] ?? 0
                const goalValue = goalByAgent[member.uid]
                const hasGoal = goalValue != null
                const pct = hasGoal && goalValue > 0 ? Math.min((closed / goalValue) * 100, 100) : 0

                return (
                  <div key={member.uid} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{member.display_name}</span>
                      <div className="flex items-center gap-2">
                        {hasGoal ? (
                          <span className="text-muted-foreground">
                            {closed} de {goalValue} ventas
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Sin meta</span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => openGoalModal(member.uid, member.display_name)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Meta
                        </Button>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      {hasGoal && (
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clientes por status</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : totalClients === 0 ? (
            <p className="text-muted-foreground">No hay clientes aún</p>
          ) : (
            <div className="space-y-3">
              {(Object.keys(STATUS_LABELS) as ClientStatus[]).map((status) => {
                const count = statusBreakdown[status] || 0
                const pct = totalClients > 0 ? (count / totalClients) * 100 : 0
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{STATUS_LABELS[status]}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${STATUS_COLORS[status]} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goal modal for team members */}
      {goalTargetUid && (
        <GoalModal
          open={goalModalOpen}
          onOpenChange={(open) => {
            setGoalModalOpen(open)
            if (!open) setGoalTargetUid(null)
          }}
          targetUid={goalTargetUid}
          teamId={activeTeamId}
          targetName={goalTargetName}
        />
      )}
    </div>
  )
}
