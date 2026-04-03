import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useClients, useUpdateClient } from '@/hooks/useClients'
import { useUpcomingCalls } from '@/hooks/useCalls'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useGoals } from '@/hooks/useGoals'
import StatusBadge from '@/components/clients/StatusBadge'
import OutcomeBadge from '@/components/calls/OutcomeBadge'
import GoalModal from '@/components/goals/GoalModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  UserPlus,
  PhoneOutgoing,
  DollarSign,
  Trophy,
  Target,
  AlertTriangle,
  Clock,
  Plus,
  ExternalLink,
} from 'lucide-react'
import { getClientDisplayName } from '@/lib/clientUtils'
import { getStateTimezone, getTimezoneLabel } from '@/lib/timezones'
import { formatInTimeZone } from 'date-fns-tz'
import { isToday } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Home() {
  const { data: clients } = useClients()
  const { data: upcomingCalls } = useUpcomingCalls(5)
  const { wsCtx } = useUserProfile()
  const { dailyGoal, monthlyGoal } = useGoals(wsCtx?.uid)
  const updateClient = useUpdateClient()
  const [goalModalOpen, setGoalModalOpen] = useState(false)

  // ── Activity metrics ──
  const allClients = clients ?? []

  const createdToday = allClients.filter((c) => {
    const d = c.created_at?.toDate?.()
    return d && isToday(d)
  }).length

  const contactedToday = allClients.filter((c) => {
    if (c.status !== 'contactado') return false
    const d = c.updated_at?.toDate?.()
    return d && isToday(d)
  }).length

  const closedToday = allClients.filter((c) => {
    if (c.status !== 'cerrado') return false
    const d = c.updated_at?.toDate?.()
    return d && isToday(d)
  }).length

  const paymentsToday = allClients.reduce((sum, c) => {
    if (!c.payments) return sum
    const todayPayments = c.payments.filter((p) => {
      try {
        return isToday(new Date(p.date))
      } catch {
        return false
      }
    })
    return sum + todayPayments.reduce((s, p) => s + p.amount, 0)
  }, 0)

  // ── Goals progress ──
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const closedThisMonth = allClients.filter((c) => {
    if (c.status !== 'cerrado') return false
    const d = c.updated_at?.toDate?.()
    if (!d) return false
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return m === currentMonth
  }).length

  // ── Debts ──
  const debtClients = allClients.filter((c) => c.status === 'deuda_pendiente')

  // ── Recent clients (exclude archived) ──
  const recentClients = allClients.filter((c) => !c.archived).slice(0, 5)

  const handleMarkLost = (clientId: string) => {
    updateClient.mutate({ id: clientId, data: { status: 'perdido' } })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Inicio</h1>

      {/* Activity metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-3">
              <UserPlus className="h-5 w-5 text-blue-700 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Creados hoy</p>
              <p className="text-2xl font-bold">{createdToday}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-lg bg-yellow-100 dark:bg-yellow-900/30 p-3">
              <PhoneOutgoing className="h-5 w-5 text-yellow-700 dark:text-yellow-300" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contactados hoy</p>
              <p className="text-2xl font-bold">{contactedToday}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-3">
              <Trophy className="h-5 w-5 text-green-700 dark:text-green-300" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ventas cerradas hoy</p>
              <p className="text-2xl font-bold">{closedToday}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-3">
              <DollarSign className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pagos recibidos hoy</p>
              <p className="text-2xl font-bold">
                ${paymentsToday.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Metas de ventas
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setGoalModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Definir meta
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Daily goal */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium">Meta del día</span>
              {dailyGoal ? (
                <span className="text-muted-foreground">
                  {closedToday} de {dailyGoal.value} ventas
                </span>
              ) : (
                <span className="text-muted-foreground">Sin meta definida</span>
              )}
            </div>
            {dailyGoal ? (
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{
                    width: `${Math.min((closedToday / dailyGoal.value) * 100, 100)}%`,
                  }}
                />
              </div>
            ) : (
              <div className="h-3 rounded-full bg-muted" />
            )}
          </div>
          {/* Monthly goal */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium">Meta del mes</span>
              {monthlyGoal ? (
                <span className="text-muted-foreground">
                  {closedThisMonth} de {monthlyGoal.value} ventas
                </span>
              ) : (
                <span className="text-muted-foreground">Sin meta definida</span>
              )}
            </div>
            {monthlyGoal ? (
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{
                    width: `${Math.min((closedThisMonth / monthlyGoal.value) * 100, 100)}%`,
                  }}
                />
              </div>
            ) : (
              <div className="h-3 rounded-full bg-muted" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Debts section */}
      {debtClients.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Deudas pendientes ({debtClients.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {debtClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <div className="text-sm min-w-0 flex-1">
                    <Link
                      to={`/clientes/${client.id}`}
                      className="font-medium hover:underline"
                    >
                      {getClientDisplayName(client)}
                    </Link>
                    {client.llc_name && (
                      <p className="text-muted-foreground truncate">{client.llc_name}</p>
                    )}
                    {client.payment_total != null && (
                      <p className="text-amber-600 dark:text-amber-400 font-medium">
                        Pendiente: ${client.payment_total.toLocaleString('en-US')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/clientes/${client.id}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleMarkLost(client.id)}
                      disabled={updateClient.isPending}
                    >
                      Deuda perdida
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  const client = allClients.find((c) => c.id === call.client_id)
                  const clientName = client ? getClientDisplayName(client) : 'Cliente'
                  return (
                    <div
                      key={call.id}
                      className="flex items-center justify-between gap-2 border-b pb-2 last:border-0"
                    >
                      <div className="text-sm min-w-0">
                        <Link
                          to={`/clientes/${call.client_id}`}
                          className="font-medium hover:underline truncate block"
                        >
                          {clientName}
                        </Link>
                        <p className="text-muted-foreground">
                          {call.scheduled_at?.toDate?.()?.toLocaleString('es-MX', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }) ?? 'Sin fecha'}
                        </p>
                        {(() => {
                          const scheduledDate = call.scheduled_at?.toDate?.()
                          if (!client?.state || !scheduledDate) return null
                          const tz = getStateTimezone(client.state)
                          const clientTime = formatInTimeZone(scheduledDate, tz, 'h:mm a', {
                            locale: es,
                          })
                          const label = getTimezoneLabel(tz)
                          return (
                            <p className="text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {clientTime} ({label})
                            </p>
                          )
                        })()}
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
                  <div
                    key={client.id}
                    className="flex items-center justify-between gap-2 border-b pb-2 last:border-0"
                  >
                    <div className="text-sm min-w-0">
                      <Link
                        to={`/clientes/${client.id}`}
                        className="font-medium hover:underline truncate block"
                      >
                        {getClientDisplayName(client)}
                      </Link>
                      {client.llc_name && (
                        <p className="text-muted-foreground truncate">{client.llc_name}</p>
                      )}
                    </div>
                    <StatusBadge status={client.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Goal Modal */}
      {wsCtx && (
        <GoalModal
          open={goalModalOpen}
          onOpenChange={setGoalModalOpen}
          targetUid={wsCtx.uid}
        />
      )}
    </div>
  )
}
