import { Link } from 'react-router-dom'
import { useClients } from '@/hooks/useClients'
import { useUpcomingCalls } from '@/hooks/useCalls'
import StatusBadge from '@/components/clients/StatusBadge'
import OutcomeBadge from '@/components/calls/OutcomeBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Phone, Clock } from 'lucide-react'
import StateClock from '@/components/states/StateClock'
import { getStateTimezone } from '@/lib/timezones'

export default function Home() {
  const { data: clients } = useClients()
  const { data: upcomingCalls } = useUpcomingCalls(5)

  const totalClients = clients?.length ?? 0
  const enProceso = clients?.filter((c) => c.status === 'en_proceso').length ?? 0

  const today = new Date()
  const todayCalls = upcomingCalls?.filter((c) => {
    const d = c.scheduled_at?.toDate?.()
    return d && d.toDateString() === today.toDateString()
  }).length ?? 0

  const recentClients = clients?.slice(0, 5) ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Inicio</h1>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-3">
              <Users className="h-5 w-5 text-blue-700 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total clientes</p>
              <p className="text-2xl font-bold">{totalClients}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-3">
              <Phone className="h-5 w-5 text-green-700 dark:text-green-300" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Llamadas hoy</p>
              <p className="text-2xl font-bold">{todayCalls}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-lg bg-orange-100 dark:bg-orange-900/30 p-3">
              <Clock className="h-5 w-5 text-orange-700 dark:text-orange-300" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">En proceso</p>
              <p className="text-2xl font-bold">{enProceso}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Calls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Próximas llamadas</CardTitle>
          </CardHeader>
          <CardContent>
            {!upcomingCalls || upcomingCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay llamadas pendientes</p>
            ) : (
              <div className="space-y-3">
                {upcomingCalls.map((call) => {
                  const client = clients?.find((c) => c.id === call.client_id)
                  const clientName = client?.first_name || client?.last_name
                    ? `${client.first_name || ''} ${client.last_name || ''}`.trim()
                    : client?.phone ?? 'Cliente'
                  return (
                    <div key={call.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div className="text-sm">
                        <Link to={`/clientes/${call.client_id}`} className="font-medium hover:underline">
                          {clientName}
                        </Link>
                        <p className="text-muted-foreground">
                          {call.scheduled_at?.toDate?.()?.toLocaleString('es-MX', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }) ?? 'Sin fecha'}
                        </p>
                        {client?.state && (
                          <div className="mt-0.5">
                            <StateClock timezone={getStateTimezone(client.state)} />
                          </div>
                        )}
                      </div>
                      <OutcomeBadge outcome={call.outcome} />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Clients */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Últimos clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay clientes aún</p>
            ) : (
              <div className="space-y-3">
                {recentClients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div className="text-sm">
                      <Link to={`/clientes/${client.id}`} className="font-medium hover:underline">
                        {client.first_name || client.last_name
                          ? `${client.first_name || ''} ${client.last_name || ''}`.trim()
                          : client.phone}
                      </Link>
                      {client.llc_name && <p className="text-muted-foreground">{client.llc_name}</p>}
                    </div>
                    <StatusBadge status={client.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
