import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useClient, useUpdateClient, useDeleteClient } from '@/hooks/useClients'
import { useCalls } from '@/hooks/useCalls'
import StatusSelect from '@/components/clients/StatusSelect'
import OutcomeBadge from '@/components/calls/OutcomeBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Pencil, Trash2, Phone } from 'lucide-react'
import type { ClientStatus } from '@/types'
import { toast } from 'sonner'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: client, isLoading } = useClient(id)
  const { data: calls } = useCalls({ clientId: id })
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

  const currentNotes = notes ?? client.notes ?? ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/clientes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {client.first_name || client.last_name
                ? `${client.first_name || ''} ${client.middle_name ? client.middle_name + ' ' : ''}${client.last_name || ''}`.trim()
                : client.phone}
            </h1>
            {client.llc_name && <p className="text-muted-foreground">{client.llc_name}</p>}
            {!client.first_name && !client.last_name && (
              <p className="text-muted-foreground text-sm">Sin nombre — agrega datos desde Editar</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/clientes/${client.id}/editar`}>
              <Pencil className="mr-2 h-3 w-3" />
              Editar
            </Link>
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
              <div>
                <p className="text-muted-foreground">Teléfono</p>
                <p className="font-medium">{client.phone}</p>
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
              <p className="font-medium">{client.business_address || '—'}</p>
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
