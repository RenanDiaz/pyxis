import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useClients, useUpdateClient } from '@/hooks/useClients'
import { useCalls, useUpcomingCalls } from '@/hooks/useCalls'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useGoals } from '@/hooks/useGoals'
import { useAuth } from '@/contexts/AuthContext'
import { useNow } from '@/hooks/useNow'
import StatusBadge from '@/components/clients/StatusBadge'
import OutcomeBadge from '@/components/calls/OutcomeBadge'
import GoalModal from '@/components/goals/GoalModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Target,
  AlertTriangle,
  Clock,
  Plus,
  Phone,
  TrendingUp,
  TrendingDown,
  CalendarClock,
} from 'lucide-react'
import { getClientDisplayName, getPrimaryPhoneNumber } from '@/lib/clientUtils'
import { isLeadCall } from '@/lib/leads'
import { getClientPayments, getClientPaymentSummary, parsePaymentDate } from '@/lib/processUtils'
import { getClientTimezone, getTimezoneLabel } from '@/lib/timezones'
import { formatMoney } from '@/lib/format'
import { formatLocalTime } from '@/lib/callTime'
import { isToday, isYesterday, formatDistanceToNow, format, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { sumMoney } from '@/lib/money'
import { countClosed, countContacted } from '@/lib/statusHistory'
import { toast } from 'sonner'
import ErrorState from '@/components/shared/ErrorState'

/** Pequeño delta contextual (▲/▼ vs. ayer). */
function Delta({ diff, prefix = '' }: { diff: number; prefix?: string }) {
  if (diff === 0) {
    return <span className="text-xs font-semibold text-muted-foreground/70">= vs. ayer</span>
  }
  const up = diff > 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold',
        up ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {prefix}
      {formatMoney(Math.abs(diff))} vs. ayer
    </span>
  )
}

/** Placeholder mientras cargan los datos (antes se veía $0 / 0 como si fuera real). */
function MetricSkeleton() {
  return <span className="inline-block h-8 w-16 animate-pulse rounded-md bg-muted align-middle" aria-label="Cargando" />
}

export default function Home() {
  const { data: clients, isLoading: clientsLoading, error: clientsError, refetch: refetchClients } = useClients()
  const { data: archivedClients } = useClients({ archived: true })
  const { data: upcomingCalls } = useUpcomingCalls(5)
  const { wsCtx } = useUserProfile()
  const { user } = useAuth()
  const { dailyGoal, monthlyGoal } = useGoals(wsCtx?.uid)
  const updateClient = useUpdateClient()
  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const now = useNow(30_000)
  // Llamadas de hoy (incluye intentos de contacto) para "Contactados hoy".
  const { data: callsToday } = useCalls({ fromDate: startOfDay(now), toDate: endOfDay(now) })

  const allClients = clients ?? []

  // ── Métricas de hoy y ayer (para contexto) ──
  const createdToday = allClients.filter((c) => {
    const d = c.created_at?.toDate?.()
    return d && isToday(d)
  }).length
  const createdYesterday = allClients.filter((c) => {
    const d = c.created_at?.toDate?.()
    return d && isYesterday(d)
  }).length

  // Con las fechas del historial de status, no con `updated_at`: editar un
  // cliente cerrado hace meses ya no lo cuenta como venta de hoy.
  const contactedToday = countContacted(allClients, callsToday ?? [], isToday)
  const closedToday = countClosed(allClients, isToday)

  const sumPaymentsFor = (predicate: (d: Date) => boolean) =>
    sumMoney(
      allClients.flatMap((c) =>
        getClientPayments(c)
          .filter((p) => {
            const d = parsePaymentDate(p.date)
            return d ? predicate(d) : false
          })
          .map((p) => p.amount),
      ),
    )

  const paymentsToday = sumPaymentsFor(isToday)
  const paymentsYesterday = sumPaymentsFor(isYesterday)

  // ── Meta mensual ──
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const closedThisMonth = countClosed(
    allClients,
    (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === currentMonth,
  )
  const monthlyPct = monthlyGoal
    ? Math.min(Math.round((closedThisMonth / monthlyGoal.value) * 100), 100)
    : 0
  const dailyPct = dailyGoal
    ? Math.min(Math.round((closedToday / dailyGoal.value) * 100), 100)
    : 0

  // ── Deudas ──
  const debtClients = allClients.filter((c) => c.status === 'deuda_pendiente')

  // ── Próxima llamada (protagonista) ──
  const nextCall = upcomingCalls?.[0]
  // La próxima llamada puede ser de un cliente archivado: también se busca ahí.
  // También puede ser a un lead sin registrar (spec 19).
  const nextLead = nextCall && isLeadCall(nextCall) ? nextCall.lead : null
  const nextClient = nextCall?.client_id
    ? [...allClients, ...(archivedClients ?? [])].find((c) => c.id === nextCall.client_id)
    : undefined
  const nextName = nextLead ? nextLead.name : nextClient ? getClientDisplayName(nextClient) : null
  const nextState = nextLead ? nextLead.state : nextClient?.state
  const nextScheduled = nextCall?.scheduled_at?.toDate?.()
  const nextPhone = nextLead ? nextLead.phone : nextClient ? getPrimaryPhoneNumber(nextClient) : ''
  const nextTz = nextState ? getClientTimezone(nextState, nextPhone).timezone : null
  const nextBalance = nextClient ? getClientPaymentSummary(nextClient).balance : 0

  // ── Listas secundarias ──
  const recentClients = allClients.filter((c) => !c.archived).slice(0, 5)

  const handleMarkLost = (clientId: string, name: string) => {
    if (!confirm(`¿Marcar la deuda de ${name} como perdida? El cliente pasará a "perdido".`)) return
    updateClient.mutate(
      { id: clientId, data: { status: 'perdido' } },
      { onSuccess: () => toast.success('Cliente marcado como perdido') },
    )
  }

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = (user?.displayName || '').split(' ')[0]
  const dateLabel = format(now, "EEEE d 'de' MMMM", { locale: es })
  const dateLabelCap = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)

  // Sin clientes, las métricas en 0 serían engañosas: mejor decir que no cargaron.
  if (clientsError) {
    return <ErrorState error={clientsError} what="los datos del inicio" onRetry={() => refetchClients()} />
  }

  return (
    <div className="space-y-4">
      {/* Saludo */}
      <div>
        <p className="text-sm text-muted-foreground">{dateLabelCap}</p>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {greeting}
          {firstName ? `, ${firstName}` : ''} 👋
        </h1>
      </div>

      {/* Próxima llamada — protagonista */}
      {nextCall && nextName ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[linear-gradient(120deg,#312e81,#4f46e5)] p-6 text-white">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-indigo-200">
              Tu próxima llamada
              {nextScheduled && ` · ${formatDistanceToNow(nextScheduled, { locale: es, addSuffix: true })}`}
            </p>
            <p className="mt-1 truncate text-xl font-extrabold tracking-tight">
              {nextName}
              {nextLead && <span className="text-base font-medium text-indigo-200"> · Lead</span>}
              {nextState && (
                <span className="text-base font-medium text-indigo-200"> · {nextState}</span>
              )}
            </p>
            <p className="mt-1.5 text-sm text-indigo-100">
              {nextClient?.llc_name ? `${nextClient.llc_name} · ` : ''}
              {nextScheduled && nextTz
                ? `${formatLocalTime(nextScheduled, nextTz, 'h:mm a')} hora local (${getTimezoneLabel(nextTz)})`
                : nextScheduled
                  ? format(nextScheduled, "d MMM · h:mm a", { locale: es })
                  : 'Sin fecha'}
              {nextBalance > 0 && ` · saldo pendiente $${formatMoney(nextBalance)}`}
            </p>
          </div>
          <div className="flex gap-2">
            {nextPhone && (
              <Button
                asChild
                className="rounded-xl bg-white font-bold text-indigo-900 hover:bg-white/90"
              >
                <a href={`tel:${nextPhone}`}>
                  <Phone className="mr-1 h-4 w-4" />
                  Llamar ahora
                </a>
              </Button>
            )}
            <Button
              asChild
              variant="secondary"
              className="rounded-xl border-0 bg-white/15 text-white hover:bg-white/25"
            >
              {nextClient ? (
                <Link to={`/clientes/${nextClient.id}`}>Ver cliente</Link>
              ) : (
                <Link to="/agenda">Ver en la agenda</Link>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-6 text-muted-foreground">
          <CalendarClock className="h-5 w-5" />
          <div>
            <p className="font-semibold text-foreground">No tienes llamadas próximas</p>
            <p className="text-sm">
              Agenda tu siguiente llamada desde{' '}
              <Link to="/agenda" className="text-primary underline">
                la agenda
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* Métricas con contexto */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Creados hoy</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight">{clientsLoading ? <MetricSkeleton /> : createdToday}</p>
            <p className="mt-1.5">
              <Delta diff={createdToday - createdYesterday} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Contactados hoy</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight">{clientsLoading ? <MetricSkeleton /> : contactedToday}</p>
            {/* La meta diaria es de ventas: no aplica a contactos. */}
            <p className="mt-1.5 text-xs font-semibold text-muted-foreground/70">clientes distintos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Ventas cerradas hoy</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight text-green-600 dark:text-green-400">
              {clientsLoading ? <MetricSkeleton /> : closedToday}
            </p>
            <p className="mt-1.5 text-xs font-semibold text-muted-foreground/70">
              {dailyGoal ? `meta del día · ${dailyGoal.value}` : 'sin meta definida'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pagos recibidos hoy</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight">
              {clientsLoading ? <MetricSkeleton /> : `$${formatMoney(paymentsToday)}`}
            </p>
            <p className="mt-1.5">
              <Delta diff={paymentsToday - paymentsYesterday} prefix="$" />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Meta + Deudas */}
      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        {/* Metas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Metas de ventas
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setGoalModalOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Definir meta
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-bold">Meta del mes</span>
                <span className="text-muted-foreground">
                  {monthlyGoal ? `${closedThisMonth} de ${monthlyGoal.value} ventas` : 'Sin meta definida'}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#4f46e5,#6366f1)] transition-all"
                  style={{ width: `${monthlyPct}%` }}
                />
              </div>
              {monthlyGoal && (
                <p className="mt-2 text-xs text-muted-foreground/70">
                  Vas <strong className="text-primary">{monthlyPct}%</strong> de tu meta mensual
                </p>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-bold">Meta del día</span>
                <span className="text-muted-foreground">
                  {dailyGoal ? `${closedToday} de ${dailyGoal.value} ventas` : 'Sin meta definida'}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${dailyPct}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deudas */}
        <Card
          className={cn(
            debtClients.length > 0 &&
              'border-violet-300 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/20',
          )}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-violet-700 dark:text-violet-400">
              <AlertTriangle className="h-4 w-4" />
              Deudas pendientes · {debtClients.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {debtClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin deudas pendientes 🎉</p>
            ) : (
              <div className="space-y-2">
                {debtClients.map((client) => {
                  const { balance, total } = getClientPaymentSummary(client)
                  const showBalance = total > 0 && balance > 0
                  return (
                    <div
                      key={client.id}
                      className="flex items-center justify-between gap-2 border-b border-violet-200/70 py-1.5 last:border-0 dark:border-violet-800/50"
                    >
                      <div className="min-w-0 flex-1 text-sm">
                        <Link to={`/clientes/${client.id}`} className="font-semibold hover:underline">
                          {getClientDisplayName(client)}
                        </Link>
                        {client.llc_name && (
                          <p className="truncate text-xs text-muted-foreground">{client.llc_name}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {showBalance && (
                          <span className="font-bold text-violet-700 dark:text-violet-400">
                            ${formatMoney(balance)}
                          </span>
                        )}
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleMarkLost(client.id, getClientDisplayName(client))}
                          disabled={updateClient.isPending}
                        >
                          Deuda perdida
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Listas secundarias */}
      <div className="grid gap-4 lg:grid-cols-2">
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
                  const lead = isLeadCall(call) ? call.lead : null
                  const client = call.client_id ? allClients.find((c) => c.id === call.client_id) : undefined
                  const clientName = lead ? lead.name : client ? getClientDisplayName(client) : 'Cliente'
                  const scheduledDate = call.scheduled_at?.toDate?.()
                  const tzState = lead ? lead.state : client?.state
                  const tz = tzState
                    ? getClientTimezone(tzState, lead ? lead.phone : client ? getPrimaryPhoneNumber(client) : '').timezone
                    : null
                  return (
                    <div
                      key={call.id}
                      className="flex items-center justify-between gap-2 border-b pb-2 last:border-0"
                    >
                      <div className="min-w-0 text-sm">
                        <Link
                          to={lead ? '/agenda' : `/clientes/${call.client_id}`}
                          className="block truncate font-medium hover:underline"
                        >
                          {clientName}
                          {lead && <span className="ml-1 text-xs font-normal text-muted-foreground">(lead)</span>}
                        </Link>
                        <p className="text-muted-foreground">
                          {scheduledDate?.toLocaleString('es-MX', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }) ?? 'Sin fecha'}
                        </p>
                        {tz && scheduledDate && (
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatLocalTime(scheduledDate, tz, 'h:mm a')} ({getTimezoneLabel(tz)})
                          </p>
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
                    <div className="min-w-0 text-sm">
                      <Link
                        to={`/clientes/${client.id}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {getClientDisplayName(client)}
                      </Link>
                      {client.llc_name && (
                        <p className="truncate text-muted-foreground">{client.llc_name}</p>
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

      {wsCtx && (
        <GoalModal open={goalModalOpen} onOpenChange={setGoalModalOpen} targetUid={wsCtx.uid} />
      )}
    </div>
  )
}
