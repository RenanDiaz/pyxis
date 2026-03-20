import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useClient, useCreateClient, useUpdateClient } from '@/hooks/useClients'
import { useStates } from '@/hooks/useStates'
import clientFormConfig from '@/data/client_form.json'
import { PROCESSES } from '@/data/processes'
import { getFieldValue } from '@/lib/processUtils'
import { getStateByAreaCode } from '@/lib/areaCodeMap'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StateClock from '@/components/states/StateClock'
import { getStateTimezone } from '@/lib/timezones'
import { ArrowLeft } from 'lucide-react'
import type { Client, ClientStatus } from '@/types'
import { toast } from 'sonner'

type FormData = Record<string, string>

export default function ClientForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = !!id
  const { data: existingClient, isLoading: clientLoading } = useClient(id)
  const { data: states } = useStates()
  const createMutation = useCreateClient()
  const updateMutation = useUpdateClient()

  const [formData, setFormData] = useState<FormData>({})
  const [status, setStatus] = useState<ClientStatus>('nuevo')
  const stateManuallySet = useRef(false)
  const [stateAutoDetected, setStateAutoDetected] = useState(false)

  useEffect(() => {
    if (existingClient) {
      const data: FormData = {}
      for (const field of clientFormConfig.fields) {
        const value = existingClient[field.id as keyof typeof existingClient]
        data[field.id] = typeof value === 'string' ? value : ''
      }
      setFormData(data)
      setStatus(existingClient.status)
      if (data.state) stateManuallySet.current = true
    }
  }, [existingClient])

  const handleChange = (fieldId: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [fieldId]: value }

      if (fieldId === 'phone' && !stateManuallySet.current) {
        const detected = getStateByAreaCode(value)
        if (detected) {
          next.state = detected
          setStateAutoDetected(true)
        } else {
          if (stateAutoDetected) {
            next.state = ''
            setStateAutoDetected(false)
          }
        }
      }

      if (fieldId === 'state') {
        stateManuallySet.current = true
        setStateAutoDetected(false)
      }

      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.phone?.trim()) {
      toast.error('El número telefónico es requerido')
      return
    }

    const clientData: Record<string, string> = {
      phone: formData.phone.trim(),
      status,
      notes: isEditing ? (existingClient?.notes || '') : '',
    }

    // Only include non-empty optional fields
    for (const field of clientFormConfig.fields) {
      if (field.id !== 'phone' && formData[field.id]?.trim()) {
        clientData[field.id] = formData[field.id].trim()
      }
    }

    try {
      if (isEditing && id) {
        await updateMutation.mutateAsync({ id, data: clientData as Partial<Client> })
        toast.success('Cliente actualizado')
        navigate(`/clientes/${id}`)
      } else {
        const newId = await createMutation.mutateAsync(clientData as Omit<Client, 'id' | 'created_at' | 'updated_at'>)
        toast.success('Cliente creado')
        navigate(`/clientes/${newId}`)
      }
    } catch {
      toast.error('Error al guardar el cliente')
    }
  }

  const formReady = !isEditing || (!!existingClient && Object.keys(formData).length > 0)

  if (isEditing && (clientLoading || !formReady)) {
    return <p className="text-muted-foreground">Cargando...</p>
  }

  const selectedState = states?.find((s) => s.abbreviation === formData.state)
  const selectedProcess = PROCESSES.find((p) => p.id === formData.process)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={isEditing ? `/clientes/${id}` : '/clientes'}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          {isEditing ? 'Editar cliente' : 'Nuevo cliente'}
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {clientFormConfig.description}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {clientFormConfig.fields.map((field) => (
                  <div key={field.id} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <Label htmlFor={field.id}>
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {field.type === 'select' && field.id === 'state' ? (
                      <>
                        <Select
                          value={formData[field.id] || '_none'}
                          onValueChange={(v) => handleChange(field.id, v === '_none' ? '' : v)}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Selecciona un estado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Selecciona un estado</SelectItem>
                            {states?.map((s) => (
                              <SelectItem key={s.abbreviation} value={s.abbreviation}>
                                {s.name} ({s.abbreviation})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {stateAutoDetected && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Detectado por código de área
                          </p>
                        )}
                      </>
                    ) : field.type === 'select' && field.id === 'process' ? (
                      <Select
                        value={formData[field.id] || '_none'}
                        onValueChange={(v) => handleChange(field.id, v === '_none' ? '' : v)}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Sin proceso asignado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Sin proceso asignado</SelectItem>
                          {PROCESSES.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === 'textarea' ? (
                      <Textarea
                        id={field.id}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        className="mt-1.5"
                        rows={3}
                      />
                    ) : (
                      <Input
                        id={field.id}
                        type={field.type === 'phone' ? 'tel' : field.type === 'email' ? 'email' : 'text'}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        className="mt-1.5"
                        autoComplete={('sensitive' in field && field.sensitive) ? 'off' : undefined}
                      />
                    )}
                  </div>
                ))}
              </div>

              {!isEditing && (
                <div>
                  <Label>Status inicial</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus)}>
                    <SelectTrigger className="mt-1.5 w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nuevo">Nuevo</SelectItem>
                      <SelectItem value="contactado">Contactado</SelectItem>
                      <SelectItem value="en_proceso">En proceso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Guardando...'
                    : isEditing
                      ? 'Actualizar'
                      : 'Crear cliente'}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to={isEditing ? `/clientes/${id}` : '/clientes'}>Cancelar</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {selectedState && selectedProcess && (
          <Card className="h-fit md:sticky md:top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                {selectedProcess.label}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {selectedState.name} ({selectedState.abbreviation})
              </p>
              <StateClock timezone={getStateTimezone(selectedState.abbreviation)} />
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                {selectedProcess.fields.map((f) => (
                  <div key={f.key} className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="font-semibold">{getFieldValue(selectedState, f.key)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
