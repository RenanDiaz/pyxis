import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useClient, useCreateClient, useUpdateClient, useFindClientsByPhone } from '@/hooks/useClients'
import { useStates } from '@/hooks/useStates'
import clientFormConfig from '@/data/client_form.json'
import { PROCESSES } from '@/data/processes'
import { getFieldValue, formatFieldValue } from '@/lib/processUtils'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Plus, X, AlertTriangle } from 'lucide-react'
import type { Client, ClientStatus, ClientPhone, PhoneLabel } from '@/types'
import { inferStatus } from '@/lib/statusUtils'
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
  const [phones, setPhones] = useState<ClientPhone[]>([
    { number: '', label: 'personal', is_primary: true },
  ])
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

      // Load phones
      if (existingClient.phones?.length) {
        setPhones(existingClient.phones)
      } else if (existingClient.phone) {
        setPhones([{ number: existingClient.phone, label: 'personal', is_primary: true }])
      }
    }
  }, [existingClient])

  // Auto-detect state from primary phone's area code
  useEffect(() => {
    if (stateManuallySet.current) return
    const primary = phones.find((p) => p.is_primary) ?? phones[0]
    if (primary?.number) {
      const detected = getStateByAreaCode(primary.number)
      if (detected) {
        setFormData((prev) => ({ ...prev, state: detected }))
        setStateAutoDetected(true)
      } else if (stateAutoDetected) {
        setFormData((prev) => ({ ...prev, state: '' }))
        setStateAutoDetected(false)
      }
    }
  }, [phones, stateAutoDetected])

  // Duplicate phone detection (debounced)
  const [debouncedPhone, setDebouncedPhone] = useState('')
  useEffect(() => {
    if (isEditing) return
    const primary = phones.find((p) => p.is_primary) ?? phones[0]
    const num = primary?.number?.trim() || ''
    const timer = setTimeout(() => setDebouncedPhone(num), 500)
    return () => clearTimeout(timer)
  }, [phones, isEditing])

  const { data: duplicateClients } = useFindClientsByPhone(isEditing ? '' : debouncedPhone)
  const duplicateClient = useMemo(
    () => duplicateClients?.find((c) => c.id !== id),
    [duplicateClients, id]
  )

  const handleChange = (fieldId: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [fieldId]: value }

      if (fieldId === 'state') {
        stateManuallySet.current = true
        setStateAutoDetected(false)
      }

      return next
    })
  }

  // Phone CRUD helpers
  const updatePhone = (index: number, field: keyof ClientPhone, value: string | boolean) => {
    setPhones((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  const setPrimaryPhone = (index: number) => {
    setPhones((prev) => prev.map((p, i) => ({ ...p, is_primary: i === index })))
  }

  const addPhone = () => {
    setPhones((prev) => [...prev, { number: '', label: 'personal', is_primary: false }])
  }

  const removePhone = (index: number) => {
    setPhones((prev) => {
      const next = prev.filter((_, i) => i !== index)
      if (next.length > 0 && !next.some((p) => p.is_primary)) {
        next[0].is_primary = true
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate phones
    const validPhones = phones.filter((p) => p.number.trim())
    if (validPhones.length === 0) {
      toast.error('Al menos un número telefónico es requerido')
      return
    }

    // Ensure one is primary
    const primaryPhone = validPhones.find((p) => p.is_primary) ?? validPhones[0]
    if (!primaryPhone.is_primary) primaryPhone.is_primary = true

    const cleanPhones = validPhones.map((p) => ({
      number: p.number.trim(),
      label: p.label,
      is_primary: p.is_primary,
    }))

    const clientData: Record<string, unknown> = {
      phone: primaryPhone.number.trim(),
      phones: cleanPhones,
      status,
      notes: isEditing ? (existingClient?.notes || '') : '',
      ...(!isEditing && { archived: false }),
    }

    // Only include non-empty optional fields
    for (const field of clientFormConfig.fields) {
      if (formData[field.id]?.trim()) {
        clientData[field.id] = (formData[field.id] as string).trim()
      }
    }

    try {
      if (isEditing && id) {
        // Auto-infer status on edit (info_added trigger)
        const newStatus = inferStatus(status, 'info_added')
        if (newStatus) {
          clientData.status = newStatus
        }
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
              {/* Phones section */}
              <div className="space-y-3">
                <Label>
                  Teléfonos <span className="text-destructive ml-1">*</span>
                </Label>
                {phones.map((phone, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <Input
                      type="tel"
                      value={phone.number}
                      onChange={(e) => updatePhone(index, 'number', e.target.value)}
                      placeholder="Número telefónico"
                      className="min-w-0 flex-1 basis-40"
                    />
                    <Select
                      value={phone.label}
                      onValueChange={(v) => updatePhone(index, 'label', v as PhoneLabel)}
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="trabajo">Trabajo</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap cursor-pointer">
                      <input
                        type="radio"
                        name="primary_phone"
                        checked={phone.is_primary}
                        onChange={() => setPrimaryPhone(index)}
                      />
                      Principal
                    </label>
                    {phones.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => removePhone(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addPhone}>
                  <Plus className="mr-1 h-3 w-3" /> Agregar teléfono
                </Button>
                {stateAutoDetected && (
                  <p className="text-xs text-muted-foreground">
                    Estado detectado por código de área del teléfono principal
                  </p>
                )}
                {!isEditing && duplicateClient && (
                  <Alert variant="default" className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 dark:text-amber-300">
                      {duplicateClient.archived
                        ? 'Este número pertenece a un cliente archivado.'
                        : 'Ya existe un cliente con este número.'}
                      {' '}
                      <Link
                        to={`/clientes/${duplicateClient.id}`}
                        className="font-medium underline hover:no-underline"
                      >
                        Ver cliente →
                      </Link>
                    </AlertDescription>
                  </Alert>
                )}
              </div>

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
                    <dd className="font-semibold">{formatFieldValue(getFieldValue(selectedState, f.key), f.format)}</dd>
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
