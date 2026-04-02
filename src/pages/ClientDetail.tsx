import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useClient, useUpdateClient, useDeleteClient } from '@/hooks/useClients'
import { useCalls } from '@/hooks/useCalls'
import { useStates } from '@/hooks/useStates'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useAuth } from '@/contexts/AuthContext'
import { PROCESSES } from '@/data/processes'
import { getFieldValue, formatFieldValue, getProcessPrice } from '@/lib/processUtils'
import StatusSelect from '@/components/clients/StatusSelect'
import PaymentSection from '@/components/clients/PaymentSection'
import OutcomeBadge from '@/components/calls/OutcomeBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StateClock from '@/components/states/StateClock'
import { getStateTimezone } from '@/lib/timezones'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import DocumentGrid from '@/components/documents/DocumentGrid'
import { ArrowLeft, Pencil, Trash2, Phone, FileDown, Archive, ArchiveRestore } from 'lucide-react'
import type { ClientStatus } from '@/types'
import { toast } from 'sonner'
import { exportClientDoc } from '@/lib/exportClientDoc'
import { getClientDisplayName, getAllPhones, PHONE_LABELS } from '@/lib/clientUtils'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { role } = useUserProfile()
  const { data: client, isLoading } = useClient(id)
  const { data: calls } = useCalls({ clientId: id })
  const { data: states } = useStates()
  const updateMutation = useUpdateClient()
  const deleteMutation = useDeleteClient()
  const [notes, setNotes] = useState<string | null>(null)

  if (isLoading) {
    return <p className="text-muted-foreground">Cargando...</p>
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cliente no encontrado</p>
        <Link to="/clientes" className="text-primary underline mt-2 inline-block">
          Volver a clientes
        </Link>
      </div>
    )
  }

  const handleStatusChange = async (status: ClientStatus) => {
    await updateMutation.mutateAsync({ id: client.id, data: { status } })
    toast.success('Status actualizado')
  }

  const handleSaveNotes = async () => {
    if (notes === null) return
    await updateMutation.mutateAsync({ id: client.id, data: { notes } })
    toast.success('Notas guardadas')
  }

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar este cliente?')) return
    await deleteMutation.mutateAsync(client.id)
    toast.success('Cliente eliminado')
    navigate('/clientes')
  }

  const handleToggleArchive = async () => {
    if (!client.archived) {
      if (!confirm('Este cliente no aparecerá en tus listas activas. Puedes encontrarlo activando \'Mostrar archivados\'.')) return
    }
    const newArchived = !client.archived
    await updateMutation.mutateAsync({ id: client.id, data: { archived: newArchived } })
    toast.success(newArchived ? 'Cliente archivado' : 'Cliente desarchivado')
  }

  const currentNotes = notes ?? client.notes ?? ''

  return (
    <div className="space-y-6">
      {client.archived && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <Archive className="h-4 w-4 shrink-0" />
          Este cliente está archivado
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/clientes" className="shrink-0">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {client.first_name || client.last_name
                ? `${client.first_name || ''} ${client.middle_name ? client.middle_name + ' ' : ''}${client.last_name || ''}`.trim()
                : getClientDisplayName(client)}
            </h1>
            {client.llc_name && <p className="text-muted-foreground truncate">{client.llc_name}</p>}
            {!client.first_name && !client.last_name && (
              <p className="text-muted-foreground text-sm">Sin nombre — agrega datos desde Editar</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => exportClientDoc(client)}>
            <FileDown className="mr-2 h-3 w-3" />
            <span className="hidden sm:inline">Exportar</span> .docx
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`/clientes/${client.id}/editar`}>
              <Pencil className="mr-2 h-3 w-3" />
              Editar
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleToggleArchive}>
            {client.archived ? (
              <>
                <ArchiveRestore className="mr-2 h-3 w-3" />
                Desarchivar
              </>
            ) : (
              <>
                <Archive className="mr-2 h-3 w-3" />
                Archivar
              </>
            )}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-2 h-3 w-3" />
            Eliminar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Información</CardTitle>
              <StatusSelect value={client.status} onChange={handleStatusChange} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <p className="text-muted-foreground mb-1">Teléfono(s)</p>
                {(() => {
                  const allPhones = getAllPhones(client)
                  if (allPhones.length === 0) return <p className="font-medium">—</p>
                  return (
                    <div className="space-y-1">
                      {allPhones.map((p, i) => (
                        <a
                          key={i}
                          href={`tel:${p.number}`}
                          className="flex items-center gap-1.5 font-medium text-primary hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {p.number}
                          <span className="text-xs text-muted-foreground font-normal">
                            ({PHONE_LABELS[p.label] || p.label})
                            {p.is_primary && ' — principal'}
                          </span>
                        </a>
                      ))}
                    </div>
                  )
                })()}
              </div>
              <div>
                <p className="text-muted-foreground">Estado</p>
                <p className="font-medium">{client.state || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{client.email || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">SSN/ITIN</p>
                <p className="font-medium">{client.ssn_itin ? `••••${client.ssn_itin.slice(-4)}` : '—'}</p>
              </div>
            </div>
            <Separator />
            <div className="text-sm">
              <p className="text-muted-foreground">Dirección comercial</p>
              <p className="font-medium whitespace-pre-line">{client.business_address || '—'}</p>
            </div>
            <div className="text-sm">
              <p className="text-muted-foreground">Propósito del negocio</p>
              <p className="font-medium">{client.business_purpose || '—'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Notas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={currentNotes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Escribe notas sobre el cliente..."
              rows={6}
            />
            <Button
              size="sm"
              onClick={handleSaveNotes}
              disabled={notes === null || updateMutation.isPending}
            >
              Guardar notas
            </Button>
          </CardContent>
        </Card>
      </div>

      {client.process && client.state && (() => {
        const process = PROCESSES.find((p) => p.id === client.process)
        const state = states?.find((s) => s.abbreviation === client.state)
        if (!process || !state) return null
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Proceso contratado
              </CardTitle>
              <p className="text-sm font-medium">
                {process.label} — {state.name} ({state.abbreviation})
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <StateClock timezone={getStateTimezone(state.abbreviation)} />
              <dl className="grid gap-3 sm:grid-cols-2">
                {process.fields.map((f) => (
                  <div key={f.key} className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="font-semibold">{formatFieldValue(getFieldValue(state, f.key), f.format)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )
      })()}

      <PaymentSection
        client={client}
        onUpdate={async (data) => {
          await updateMutation.mutateAsync({ id: client.id, data })
          toast.success('Pagos actualizados')
        }}
        isPending={updateMutation.isPending}
        suggestedTotal={(() => {
          if (client.payment_total) return null
          const st = client.state && states?.find((s) => s.abbreviation === client.state)
          return st && client.process ? getProcessPrice(st, client.process) : null
        })()}
      />

      <DocumentGrid
        clientId={client.id}
        currentUid={user?.uid ?? ''}
        currentRole={role}
        currentDisplayName={user?.displayName ?? user?.email ?? ''}
        clientStatus={client.status}
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Historial de llamadas
            </CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link to={`/agenda?client=${client.id}`}>
                <Phone className="mr-2 h-3 w-3" />
                Agendar llamada
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!calls || calls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay llamadas registradas</p>
          ) : (
            <div className="space-y-3">
              {calls.map((call) => (
                <div key={call.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="text-sm">
                    <p className="font-medium">
                      {call.scheduled_at?.toDate?.()?.toLocaleDateString('es-MX') ?? 'Sin fecha'}
                    </p>
                    <p className="text-muted-foreground">{call.notes || 'Sin notas'}</p>
                  </div>
                  <OutcomeBadge outcome={call.outcome} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
