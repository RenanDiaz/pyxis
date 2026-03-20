import { useState } from 'react'
import { useCalls, useCreateCall, useUpdateCall } from '@/hooks/useCalls'
import { useClients } from '@/hooks/useClients'
import { OUTCOME_CONFIG } from '@/components/calls/OutcomeBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Phone } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import type { CallOutcome } from '@/types'
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

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

export default function Schedule() {
  const [tab, setTab] = useState<FilterTab>('todas')
  const [dialogOpen, setDialogOpen] = useState(false)

  const dateFilters = getDateFilters(tab)
  const { data: calls, isLoading } = useCalls({
    ...dateFilters,
    outcome: tab === 'pendientes' ? 'pendiente' : undefined,
  })
  const { data: clients } = useClients()

  // New call form state
  const [newCallClientId, setNewCallClientId] = useState('')
  const [newCallDate, setNewCallDate] = useState('')
  const [newCallTime, setNewCallTime] = useState('')
  const [newCallNotes, setNewCallNotes] = useState('')
  const createCallMutation = useCreateCall()
  const updateCallMutation = useUpdateCall()

  const handleCreateCall = async () => {
    if (!newCallClientId || !newCallDate || !newCallTime) {
      toast.error('Completa los campos requeridos')
      return
    }
    const scheduledAt = new Date(`${newCallDate}T${newCallTime}`)
    try {
      await createCallMutation.mutateAsync({
        client_id: newCallClientId,
        scheduled_at: Timestamp.fromDate(scheduledAt),
        notes: newCallNotes,
        outcome: 'pendiente',
      })
      toast.success('Llamada agendada')
      setDialogOpen(false)
      setNewCallClientId('')
      setNewCallDate('')
      setNewCallTime('')
      setNewCallNotes('')
    } catch {
      toast.error('Error al agendar llamada')
    }
  }

  const handleOutcomeChange = async (callId: string, outcome: CallOutcome) => {
    await updateCallMutation.mutateAsync({ id: callId, data: { outcome } })
    toast.success('Llamada actualizada')
  }

  const getClientName = (clientId: string) => {
    const client = clients?.find((c) => c.id === clientId)
    if (!client) return 'Cliente desconocido'
    return client.first_name || client.last_name
      ? `${client.first_name || ''} ${client.last_name || ''}`.trim()
      : client.phone
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva llamada
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar llamada</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Cliente</Label>
                <Select value={newCallClientId} onValueChange={setNewCallClientId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecciona un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name || c.last_name
                          ? `${c.first_name || ''} ${c.last_name || ''}`.trim()
                          : c.phone}
                        {c.llc_name ? ` — ${c.llc_name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={newCallDate}
                    onChange={(e) => setNewCallDate(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Hora</Label>
                  <Input
                    type="time"
                    value={newCallTime}
                    onChange={(e) => setNewCallTime(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label>Notas</Label>
                <Textarea
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
          <TabsTrigger value="hoy">Hoy</TabsTrigger>
          <TabsTrigger value="semana">Esta semana</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando llamadas...</p>
      ) : !calls || calls.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Phone className="mx-auto h-8 w-8 mb-2" />
          <p>No hay llamadas {tab !== 'todas' ? 'para este filtro' : 'agendadas'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <Card key={call.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <Link
                    to={`/clientes/${call.client_id}`}
                    className="font-medium hover:underline"
                  >
                    {getClientName(call.client_id)}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {call.scheduled_at?.toDate?.()?.toLocaleString('es-MX', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }) ?? 'Sin fecha'}
                  </p>
                  {call.notes && (
                    <p className="text-sm text-muted-foreground mt-1">{call.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={call.outcome}
                    onValueChange={(v) => handleOutcomeChange(call.id, v as CallOutcome)}
                  >
                    <SelectTrigger className="w-[150px]">
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
          ))}
        </div>
      )}
    </div>
  )
}
