import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useClient, useUpdateClient, useDeleteClient } from '@/hooks/useClients'
import { useCalls, useCreateCall } from '@/hooks/useCalls'
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
import { useWorkspaceMembers, useAssignableMembers } from '@/hooks/useWorkspace'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Pencil, Trash2, Phone, Mail, FileDown, Archive, ArchiveRestore, UserCircle, RefreshCw, Info } from 'lucide-react'
import type { ClientStatus } from '@/types'
import { Timestamp } from 'firebase/firestore'
import { toast } from 'sonner'
import { exportClientDoc } from '@/lib/exportClientDoc'
import { getClientDisplayName, getAllPhones, getPrimaryPhoneNumber, PHONE_LABELS } from '@/lib/clientUtils'
import { formatPhoneForWhatsApp } from '@/lib/phoneUtils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { role, workspaceId, profile: member } = useUserProfile()
  const { data: client, isLoading } = useClient(id)
  const { data: calls } = useCalls({ clientId: id })
  const { data: states } = useStates()
  const updateMutation = useUpdateClient()
  const deleteMutation = useDeleteClient()
  const createCallMutation = useCreateCall()
  const [notes, setNotes] = useState<string | null>(null)

  const showAgent = role === 'owner' || role === 'supervisor'
  const { data: members } = useWorkspaceMembers(showAgent ? workspaceId : null)
  const agentName = showAgent && client && members
    ? members.find((m) => m.uid === client.owner_uid)?.display_name || 'Desconocido'
    : null

  // Reassignment
  const { data: assignableMembers } = useAssignableMembers(
    workspaceId,
    role,
    member?.subteam_id ?? null
  )
  const [showReassign, setShowReassign] = useState(false)
  const [reassignUid, setReassignUid] = useState('')

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

  const primaryPhone = getPrimaryPhoneNumber(client)
  const whatsappNumber = primaryPhone ? formatPhoneForWhatsApp(primaryPhone) : ''

  const handleContactClick = (channel: 'WhatsApp' | 'Llamada' | 'Email') => {
    toast('¿Registrar intento de contacto?', {
      action: {
        label: 'Sí, registrar',
        onClick: () => {
          createCallMutation.mutate(
            {
              client_id: client.id,
              scheduled_at: Timestamp.now(),
              notes: `Contacto iniciado vía ${channel}`,
              outcome: 'pendiente',
            },
            {
              onSuccess: () => toast.success('Contacto registrado'),
              onError: () => toast.error('Error al registrar contacto'),
            },
          )
        },
      },
      cancel: { label: 'No', onClick: () => {} },
      duration: 6000,
    })
  }

  const handleReassign = async () => {
    if (!reassignUid || !client || reassignUid === client.owner_uid) return
    const newAgent = assignableMembers?.find((m) => m.uid === reassignUid)
    const oldAgent = members?.find((m) => m.uid === client.owner_uid)
    if (!newAgent) return

    const currentUserName = user?.displayName || user?.email || 'Sistema'
    const dateStr = format(new Date(), "d 'de' MMMM yyyy", { locale: es })
    const reassignNote = `[Sistema] Cliente reasignado de ${oldAgent?.display_name || 'Desconocido'} a ${newAgent.display_name} por ${currentUserName} el ${dateStr}`
    const updatedNotes = client.notes
      ? `${client.notes}\n\n${reassignNote}`
      : reassignNote

    await updateMutation.mutateAsync({
      id: client.id,
      data: {
        owner_uid: reassignUid,
        subteam_id: newAgent.subteam_id,
        notes: updatedNotes,
      },
    })
    setNotes(null)
    setShowReassign(false)
    setReassignUid('')
    toast.success(`Cliente reasignado a ${newAgent.display_name}`)
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
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {whatsappNumber && (
            <Button
              size="sm"
              className="bg-[#25D366] hover:bg-[#1da851] text-white h-11 sm:h-9"
              onClick={() => {
                window.open(`https://wa.me/${whatsappNumber}`, '_blank')
                handleContactClick('WhatsApp')
              }}
            >
              <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4 fill-current" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </Button>
          )}
          {primaryPhone && (
            <Button
              size="sm"
              variant="default"
              className="h-11 sm:h-9"
              onClick={() => {
                window.location.href = `tel:${primaryPhone}`
                handleContactClick('Llamada')
              }}
            >
              <Phone className="mr-2 h-4 w-4" />
              Llamar
            </Button>
          )}
          {client.email && (
            <Button
              size="sm"
              variant="outline"
              className="h-11 sm:h-9"
              onClick={() => {
                window.location.href = `mailto:${client.email}`
                handleContactClick('Email')
              }}
            >
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div />
        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
          {showAgent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setReassignUid(client.owner_uid)
                setShowReassign(true)
              }}
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Reasignar
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-2 h-3 w-3" />
            Eliminar
          </Button>
        </div>
      </div>

      {/* Reassignment modal */}
      {showReassign && assignableMembers && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <RefreshCw className="h-4 w-4" />
              Reasignar agente
            </div>
            <Select value={reassignUid} onValueChange={setReassignUid}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un agente" />
              </SelectTrigger>
              <SelectContent>
                {assignableMembers.map((m) => (
                  <SelectItem key={m.uid} value={m.uid}>
                    {m.display_name} — {m.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleReassign}
                disabled={!reassignUid || reassignUid === client.owner_uid || updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Reasignando...' : 'Confirmar'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowReassign(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Desktop: 2-column layout (40/60) — Mobile: single column */}
      <div className="lg:grid lg:grid-cols-5 lg:gap-6 space-y-6 lg:space-y-0">
        {/* Left column: info, process, notes */}
        <div className="lg:col-span-2 space-y-6">
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
                <div className="min-w-0">
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium break-all">{client.email || '—'}</p>
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
              {agentName && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <p className="text-muted-foreground">Agente asignado</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <UserCircle className="h-4 w-4 text-muted-foreground" />
                      {agentName}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

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
                  <dl className="grid gap-3">
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

          {client.partners && client.partners.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Socios de la LLC ({client.partners.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {client.partners.map((partner, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-2 text-sm">
                    <p className="font-medium">
                      {partner.first_name} {partner.last_name}
                      {partner.ownership_percentage ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {partner.ownership_percentage}%
                        </span>
                      ) : null}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {partner.ssn_itin && (
                        <div>
                          <p className="text-muted-foreground">SSN/ITIN</p>
                          <p className="font-medium">••••{partner.ssn_itin.slice(-4)}</p>
                        </div>
                      )}
                      {partner.address && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Dirección</p>
                          <p className="font-medium">{partner.address}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Notas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* System notes (reassignment history) */}
              {currentNotes.split('\n').filter((line) => line.startsWith('[Sistema]')).length > 0 && (
                <div className="space-y-1.5">
                  {currentNotes
                    .split('\n')
                    .filter((line) => line.startsWith('[Sistema]'))
                    .map((line, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-md border border-muted bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                      >
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{line.replace('[Sistema] ', '')}</span>
                      </div>
                    ))}
                </div>
              )}
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

        {/* Right column: payments, documents, call history */}
        <div className="lg:col-span-3 space-y-6">
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
            workspaceId={workspaceId ?? ''}
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
      </div>
    </div>
  )
}
