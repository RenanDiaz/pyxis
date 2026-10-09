import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { AlertTriangle, Clock, Phone, Plus } from 'lucide-react'
import { useCalls, useCreateCall, useUpdateCall } from '@/hooks/useCalls'
import { useClients } from '@/hooks/useClients'
import { OUTCOME_CONFIG } from '@/components/calls/OutcomeBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import StateClock from '@/components/states/StateClock'
import DraftBanner from '@/components/shared/DraftBanner'
import ErrorState from '@/components/shared/ErrorState'
import { getStateTimezone, getTimezoneLabel } from '@/lib/timezones'
import { getClientDisplayName } from '@/lib/clientUtils'
import {
  AGENDA_PAGE_SIZE,
  filterAgenda,
  isInPast,
  isOverdue,
  scheduledInstant,
  type AgendaView,
} from '@/lib/agenda'
import { useAuth } from '@/contexts/AuthContext'
import { useFormDraft } from '@/hooks/useFormDraft'
import { draftKey, readDraft } from '@/lib/formDraft'
import type { CallOutcome, Client } from '@/types'

/** En qué zona horaria se capturan fecha y hora de la cita. */
type TimeMode = 'cliente' | 'agente'

interface NewCallDraft {
  clientId: string
  date: string
  time: string
  notes: string
  timeMode: TimeMode
}

const EMPTY_CALL: NewCallDraft = { clientId: '', date: '', time: '', notes: '', timeMode: 'cliente' }
const NEW_CALL_FORM_ID = 'schedule:new-call'

const VIEW_LABELS: Record<AgendaView, string> = {
  pendientes: 'Pendientes',
  hoy: 'Hoy',
  semana: 'Esta semana',
  historial: 'Historial',
}

const EMPTY_MESSAGES: Record<AgendaView, string> = {
  pendientes: 'No tienes llamadas pendientes',
  hoy: 'No hay llamadas para hoy',
  semana: 'No hay llamadas esta semana',
  historial: 'Todavía no hay llamadas resueltas',
}

const agentTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

function formatIn(date: Date, timeZone: string, pattern: string) {
  return formatInTimeZone(date, timeZone, pattern, { locale: es })
}

export default function Schedule() {
  const [view, setView] = useState<AgendaView>('pendientes')
  const [visible, setVisible] = useState(AGENDA_PAGE_SIZE)
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  // "Agendar" desde el detalle del cliente llega como /agenda?client=ID.
  const clientParam = searchParams.get('client')

  // Si quedó un borrador de "Agendar llamada" (recarga, cierre del navegador),
  // se reabre el modal con lo que se había escrito.
  const [storedCall] = useState(() =>
    user ? readDraft<NewCallDraft>(draftKey(user.uid, NEW_CALL_FORM_ID)) : null,
  )
  const [callDraftSavedAt, setCallDraftSavedAt] = useState(storedCall?.savedAt ?? null)
  const [dialogOpen, setDialogOpen] = useState(!!storedCall || !!clientParam)

  const { data: calls, isLoading, error, refetch } = useCalls()
  const { data: activeClients } = useClients()
  // Las llamadas de clientes archivados también necesitan su nombre.
  const { data: archivedClients } = useClients({ archived: true })
  const clientsById = useMemo(() => {
    const map = new Map<string, Client>()
    for (const c of [...(activeClients ?? []), ...(archivedClients ?? [])]) map.set(c.id, c)
    return map
  }, [activeClients, archivedClients])

  // New call form state
  const restoredCall = { ...EMPTY_CALL, ...storedCall?.data }
  const [newCallClientId, setNewCallClientId] = useState(clientParam ?? restoredCall.clientId)
  const [newCallDate, setNewCallDate] = useState(restoredCall.date)
  const [newCallTime, setNewCallTime] = useState(restoredCall.time)
  const [newCallNotes, setNewCallNotes] = useState(restoredCall.notes)
  const [timeMode, setTimeMode] = useState<TimeMode>(restoredCall.timeMode)
  const callDraft = useFormDraft<NewCallDraft>({
    formId: NEW_CALL_FORM_ID,
    value: {
      clientId: newCallClientId,
      date: newCallDate,
      time: newCallTime,
      notes: newCallNotes,
      timeMode,
    },
    initial: clientParam ? { ...EMPTY_CALL, clientId: clientParam } : EMPTY_CALL,
  })

  const selectedClient = clientsById.get(newCallClientId)
  const clientTz = selectedClient?.state ? getStateTimezone(selectedClient.state) : null
  // Sin estado del cliente no hay zona que usar: se captura en la hora del agente.
  const captureTz = timeMode === 'cliente' && clientTz ? clientTz : null
  const scheduledAt =
    newCallDate && newCallTime ? scheduledInstant(newCallDate, newCallTime, captureTz) : null

  const resetNewCall = () => {
    setNewCallClientId('')
    setNewCallDate('')
    setNewCallTime('')
    setNewCallNotes('')
    setTimeMode('cliente')
    setCallDraftSavedAt(null)
    callDraft.clear()
  }

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    // Al cerrar, el parámetro ya cumplió su función: no reabrir al recargar.
    if (!open && clientParam) {
      searchParams.delete('client')
      setSearchParams(searchParams, { replace: true })
    }
  }

  const createCallMutation = useCreateCall()
  const updateCallMutation = useUpdateCall()

  const handleCreateCall = async () => {
    if (!newCallClientId || !scheduledAt) {
      toast.error('Completa los campos requeridos')
      return
    }
    if (
      isInPast(scheduledAt) &&
      !confirm('La fecha y hora elegidas ya pasaron. ¿Agendar la llamada de todos modos?')
    ) {
      return
    }
    try {
      await createCallMutation.mutateAsync({
        client_id: newCallClientId,
        scheduled_at: Timestamp.fromDate(scheduledAt),
        notes: newCallNotes,
        outcome: 'pendiente',
        kind: 'scheduled',
      })
      toast.success('Llamada agendada')
      handleDialogChange(false)
      resetNewCall()
    } catch {
      // El toast de error lo muestra el handler global de mutaciones.
    }
  }

  const handleOutcomeChange = async (callId: string, outcome: CallOutcome) => {
    try {
      await updateCallMutation.mutateAsync({ id: callId, data: { outcome } })
      toast.success('Llamada actualizada')
    } catch {
      // El toast de error lo muestra el handler global de mutaciones.
    }
  }

  const now = new Date()
  const viewCalls = filterAgenda(calls ?? [], view, now)
  const shown = view === 'historial' ? viewCalls.slice(0, visible) : viewCalls

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva llamada
        </Button>
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar llamada</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {callDraftSavedAt && (
                <DraftBanner savedAt={callDraftSavedAt} onDiscard={resetNewCall} />
              )}
              <div>
                <Label htmlFor="new-call-client">Cliente</Label>
                <Select value={newCallClientId} onValueChange={setNewCallClientId}>
                  <SelectTrigger id="new-call-client" className="mt-1.5">
                    <SelectValue placeholder="Selecciona un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeClients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {getClientDisplayName(c)}
                        {c.llc_name ? ` — ${c.llc_name}` : ''}
                      </SelectItem>
                    ))}
                    {/* Preseleccionado por link pero archivado: igual debe verse. */}
                    {selectedClient?.archived && (
                      <SelectItem value={selectedClient.id}>
                        {getClientDisplayName(selectedClient)} (archivado)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {clientTz && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Hora actual del cliente:</span>
                  <StateClock timezone={clientTz} />
                </div>
              )}
              {clientTz && (
                <div className="space-y-1.5">
                  <Label>La hora que vas a escribir es</Label>
                  <div className="flex gap-2" role="radiogroup">
                    {(['cliente', 'agente'] as const).map((mode) => (
                      <Button
                        key={mode}
                        type="button"
                        size="sm"
                        role="radio"
                        aria-checked={timeMode === mode}
                        variant={timeMode === mode ? 'default' : 'outline'}
                        onClick={() => setTimeMode(mode)}
                      >
                        {mode === 'cliente' ? `Hora del cliente (${getTimezoneLabel(clientTz)})` : 'Mi hora'}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="new-call-date">Fecha</Label>
                  <Input
                    id="new-call-date"
                    type="date"
                    value={newCallDate}
                    onChange={(e) => setNewCallDate(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="new-call-time">Hora</Label>
                  <Input
                    id="new-call-time"
                    type="time"
                    value={newCallTime}
                    onChange={(e) => setNewCallTime(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
              {scheduledAt && (
                <div className="space-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
                  {clientTz && (
                    <p className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Cliente: <strong>{formatIn(scheduledAt, clientTz, "EEE d MMM, h:mm a")}</strong> (
                      {getTimezoneLabel(clientTz)})
                    </p>
                  )}
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Tú: {formatIn(scheduledAt, agentTimeZone, "EEE d MMM, h:mm a")}
                  </p>
                  {isInPast(scheduledAt) && (
                    <p className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Esa fecha y hora ya pasaron
                    </p>
                  )}
                </div>
              )}
              <div>
                <Label htmlFor="new-call-notes">Notas</Label>
                <Textarea
                  id="new-call-notes"
                  value={newCallNotes}
                  onChange={(e) => setNewCallNotes(e.target.value)}
                  className="mt-1.5"
                  placeholder="Notas sobre la llamada..."
                  rows={3}
                />
              </div>
              <Button
                onClick={handleCreateCall}
                disabled={createCallMutation.isPending}
                className="w-full"
              >
                {createCallMutation.isPending ? 'Agendando...' : 'Agendar llamada'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs
        value={view}
        onValueChange={(v) => {
          setView(v as AgendaView)
          setVisible(AGENDA_PAGE_SIZE)
        }}
      >
        <TabsList>
          {(Object.keys(VIEW_LABELS) as AgendaView[]).map((v) => (
            <TabsTrigger key={v} value={v}>
              {VIEW_LABELS[v]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando llamadas...</p>
      ) : error ? (
        <ErrorState error={error} what="las llamadas" onRetry={() => refetch()} />
      ) : shown.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Phone className="mx-auto h-8 w-8 mb-2" />
          <p>{EMPTY_MESSAGES[view]}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((call) => {
            const client = clientsById.get(call.client_id)
            const scheduledDate = call.scheduled_at?.toDate?.()
            const tz = client?.state ? getStateTimezone(client.state) : null
            const overdue = isOverdue(call, now)
            return (
              <Card key={call.id} className={overdue ? 'border-amber-300 dark:border-amber-800' : undefined}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/clientes/${call.client_id}`} className="font-medium hover:underline">
                        {client ? getClientDisplayName(client) : 'Cliente no disponible'}
                      </Link>
                      {client?.archived && <Badge variant="secondary">Archivado</Badge>}
                      {overdue && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          Vencida
                        </Badge>
                      )}
                    </div>
                    {scheduledDate ? (
                      <>
                        {tz && (
                          <p className="text-sm mt-0.5 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {formatIn(scheduledDate, tz, "EEE d MMM, h:mm a")} ({getTimezoneLabel(tz)}) — hora del
                            cliente
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {tz ? 'Tú: ' : ''}
                          {formatIn(scheduledDate, agentTimeZone, "EEE d MMM yyyy, h:mm a")}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin fecha</p>
                    )}
                    {call.notes && <p className="text-sm text-muted-foreground mt-1">{call.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={call.outcome}
                      onValueChange={(v) => handleOutcomeChange(call.id, v as CallOutcome)}
                    >
                      <SelectTrigger className="w-[150px]" aria-label="Resultado de la llamada">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(OUTCOME_CONFIG) as CallOutcome[]).map((o) => (
                          <SelectItem key={o} value={o}>
                            {OUTCOME_CONFIG[o].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {view === 'historial' && viewCalls.length > visible && (
            <Button variant="outline" className="w-full" onClick={() => setVisible((n) => n + AGENDA_PAGE_SIZE)}>
              Mostrar más ({viewCalls.length - visible} restantes)
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
