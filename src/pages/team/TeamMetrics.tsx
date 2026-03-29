import { useClients } from '@/hooks/useClients'
import { useCalls } from '@/hooks/useCalls'
import { useTeamMembers } from '@/hooks/useUsers'
import { useTeamContext } from '@/contexts/TeamContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Phone, BarChart3, Trophy } from 'lucide-react'
import { startOfDay, endOfDay } from 'date-fns'
import type { ClientStatus } from '@/types'

const STATUS_LABELS: Record<ClientStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  en_proceso: 'En proceso',
  cerrado: 'Cerrado',
  perdido: 'Perdido',
}

const STATUS_COLORS: Record<ClientStatus, string> = {
  nuevo: 'bg-blue-500',
  contactado: 'bg-yellow-500',
  en_proceso: 'bg-orange-500',
  cerrado: 'bg-green-500',
  perdido: 'bg-gray-400',
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agente con más clientes
            </CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {isLoading
                ? '...'
                : topAgent
                  ? `${topAgent.display_name} (${topAgentCount})`
                  : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

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
    </div>
  )
}
