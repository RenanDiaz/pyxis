import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useClient, useCreateClient, useUpdateClient, useFindClientsByPhone } from '@/hooks/useClients'
import { useStates } from '@/hooks/useStates'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useAssignableMembers } from '@/hooks/useWorkspace'
import clientFormConfig from '@/data/client_form.json'
import {
  getProcessLabel,
  getProcessDef,
  getFieldValue,
  formatFieldValue,
  getSuggestedPrice,
} from '@/lib/processUtils'
import AddProcessDialog from '@/components/clients/AddProcessDialog'
import { getStateByAreaCode } from '@/lib/areaCodeMap'
import { formatPhoneForDisplay, isValidPhone } from '@/lib/phoneUtils'
import { CLIENT_UPPERCASE_FIELD_IDS, PARTNER_UPPERCASE_FIELD_IDS } from '@/lib/clientUtils'
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
import { Separator } from '@/components/ui/separator'
import StateClock from '@/components/states/StateClock'
import { getStateTimezone } from '@/lib/timezones'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Plus, X, AlertTriangle } from 'lucide-react'
import type { Client, ClientStatus, ClientPhone, PhoneLabel, Partner, ClientProcess } from '@/types'
import { inferStatus } from '@/lib/statusUtils'
import { toast } from 'sonner'

type FormData = Record<string, string>

export default function ClientForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = !!id
  const { data: existingClient, isLoading: clientLoading } = useClient(id)
  const { data: states } = useStates()
  const { role, workspaceId, wsCtx } = useUserProfile()
  const createMutation = useCreateClient()
  const updateMutation = useUpdateClient()

  const canAssign = !isEditing && (role === 'owner' || role === 'supervisor')
  const { data: assignableMembers } = useAssignableMembers(
    workspaceId,
    role,
    wsCtx?.subteamId ?? null
  )
  const [selectedAgentUid, setSelectedAgentUid] = useState<string>('')

  // Default to current user when assignable members load
  useEffect(() => {
    if (canAssign && wsCtx && !selectedAgentUid) {
      setSelectedAgentUid(wsCtx.uid)
    }
  }, [canAssign, wsCtx, selectedAgentUid])

  const [formData, setFormData] = useState<FormData>({})
  const [phones, setPhones] = useState<ClientPhone[]>([
    { number: '', label: 'personal', is_primary: true },
  ])
  const [partners, setPartners] = useState<Partner[]>([])
  const [processes, setProcesses] = useState<ClientProcess[]>([])
  const [showAddProcess, setShowAddProcess] = useState(false)
  const [status, setStatus] = useState<ClientStatus>('nuevo')
  const stateManuallySet = useRef(false)
  const [stateAutoDetected, setStateAutoDetected] = useState(false)

  useEffect(() => {
    if (existingClient) {
      const data: FormData = {}
      for (const field of clientFormConfig.fields) {
        const value = existingClient[field.id as keyof typeof existingClient]
        const str = typeof value === 'string' ? value : ''
        data[field.id] = CLIENT_UPPERCASE_FIELD_IDS.has(field.id) ? str.toUpperCase() : str
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

      if (existingClient.processes?.length) {
        setProcesses(existingClient.processes)
      }

      // Load partners (uppercase text fields for visual consistency with what is saved)
      if (existingClient.partners?.length) {
        setPartners(
          existingClient.partners.map((p) => ({
            ...p,
            first_name: p.first_name?.toUpperCase() ?? '',
            last_name: p.last_name?.toUpperCase() ?? '',
            ssn_itin: p.ssn_itin?.toUpperCase(),
            address: p.address?.toUpperCase(),
          })),
        )
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
      const nextValue = CLIENT_UPPERCASE_FIELD_IDS.has(fieldId) ? value.toUpperCase() : value
      const next = { ...prev, [fieldId]: nextValue }

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

  // Partner CRUD helpers
  const addPartner = () => {
    setPartners((prev) => [...prev, { first_name: '', last_name: '' }])
  }

  const updatePartner = (index: number, field: keyof Partner, value: string | number) => {
    const nextValue =
      typeof value === 'string' && PARTNER_UPPERCASE_FIELD_IDS.has(field as string)
        ? value.toUpperCase()
        : value
    setPartners((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: nextValue } : p)))
  }

  const removePartner = (index: number) => {
    setPartners((prev) => prev.filter((_, i) => i !== index))
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

    // Validate phone format
    const invalidPhone = validPhones.find((p) => !isValidPhone(p.number))
    if (invalidPhone) {
      toast.error(`Número inválido: ${invalidPhone.number}. Debe tener al menos 10 dígitos.`)
      return
    }

    const cleanPhones = validPhones.map((p) => ({
      number: formatPhoneForDisplay(p.number.trim()),
      label: p.label,
      is_primary: p.is_primary,
    }))

    const clientData: Record<string, unknown> = {
      phone: formatPhoneForDisplay(primaryPhone.number.trim()),
      phones: cleanPhones,
      status,
      notes: isEditing ? (existingClient?.notes || '') : '',
      ...(!isEditing && { archived: false }),
    }

    // Only include non-empty optional fields
    for (const field of clientFormConfig.fields) {
      if (formData[field.id]?.trim()) {
        const trimmed = (formData[field.id] as string).trim()
        clientData[field.id] = CLIENT_UPPERCASE_FIELD_IDS.has(field.id) ? trimmed.toUpperCase() : trimmed
      }
    }

    // Include partners (only those with at least a name)
    const validPartners = partners
      .filter((p) => p.first_name.trim() || p.last_name.trim())
      .map((p) => ({
        first_name: p.first_name.trim(),
        last_name: p.last_name.trim(),
        ...(p.ssn_itin?.trim() && { ssn_itin: p.ssn_itin.trim() }),
        ...(p.address?.trim() && { address: p.address.trim() }),
        ...(p.ownership_percentage != null && p.ownership_percentage > 0 && { ownership_percentage: p.ownership_percentage }),
      }))
    clientData.partners = validPartners
    clientData.processes = processes

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
        // Determine agent assignment
        const assignTo = canAssign && selectedAgentUid
          ? {
              owner_uid: selectedAgentUid,
              subteam_id: assignableMembers?.find((m) => m.uid === selectedAgentUid)?.subteam_id ?? null,
            }
          : undefined
        const newId = await createMutation.mutateAsync({
          data: clientData as Omit<Client, 'id' | 'created_at' | 'updated_at' | 'owner_uid' | 'subteam_id'>,
          assignTo,
        })
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

  const addProcess = (process: ClientProcess) => {
    setProcesses((prev) => [...prev, process])
  }

  const removeProcess = (processId: string) => {
    setProcesses((prev) => prev.filter((p) => p.id !== processId))
  }

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
              {/* Agent assignment — owner/supervisor only, create mode */}
              {canAssign && assignableMembers && assignableMembers.length > 0 && (
                <div>
                  <Label htmlFor="assigned_agent">
                    Asignar a agente <span className="text-destructive ml-1">*</span>
                  </Label>
                  <Select
                    value={selectedAgentUid}
                    onValueChange={setSelectedAgentUid}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecciona un agente" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableMembers.map((m) => (
                        <SelectItem key={m.uid} value={m.uid}>
                          {m.display_name} {m.uid === wsCtx?.uid ? '(tú)' : `— ${m.role}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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

              {/* Processes section */}
              <div className="space-y-3">
                <Separator />
                <Label>Procesos contratados</Label>
                {processes.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Sin procesos asignados. Agrega los servicios que el cliente quiere contratar.
                  </p>
                )}
                {processes.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {getProcessLabel(p.type)}
                        {p.state ? ` — ${p.state}` : ''}
                      </p>
                      {(() => {
                        const st = p.state ? states?.find((s) => s.abbreviation === p.state) : null
                        const price = getSuggestedPrice(p.type, st)
                        return (
                          <p className="text-xs text-muted-foreground">
                            {price != null ? `Precio sugerido: $${price.toLocaleString()}` : 'Precio a definir'}
                          </p>
                        )
                      })()}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeProcess(p.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddProcess(true)}>
                  <Plus className="mr-1 h-3 w-3" /> Agregar proceso
                </Button>
              </div>

              {/* Partners section */}
              <div className="space-y-3">
                <Separator />
                <Label>Socios de la LLC</Label>
                {partners.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Sin socios agregados. Si la LLC tiene más de un dueño, agrega los socios aquí.
                  </p>
                )}
                {partners.map((partner, index) => (
                  <Card key={index} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Socio {index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removePartner(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`partner_first_name_${index}`}>Primer nombre</Label>
                        <Input
                          id={`partner_first_name_${index}`}
                          value={partner.first_name}
                          onChange={(e) => updatePartner(index, 'first_name', e.target.value)}
                          className="mt-1.5"
                          placeholder="Nombre"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`partner_last_name_${index}`}>Apellidos</Label>
                        <Input
                          id={`partner_last_name_${index}`}
                          value={partner.last_name}
                          onChange={(e) => updatePartner(index, 'last_name', e.target.value)}
                          className="mt-1.5"
                          placeholder="Apellidos"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`partner_ssn_${index}`}>SSN o ITIN</Label>
                        <Input
                          id={`partner_ssn_${index}`}
                          value={partner.ssn_itin || ''}
                          onChange={(e) => updatePartner(index, 'ssn_itin', e.target.value)}
                          className="mt-1.5"
                          placeholder="SSN o ITIN"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`partner_pct_${index}`}>% de participación</Label>
                        <Input
                          id={`partner_pct_${index}`}
                          type="number"
                          min={0}
                          max={100}
                          value={partner.ownership_percentage ?? ''}
                          onChange={(e) => updatePartner(index, 'ownership_percentage', e.target.value ? Number(e.target.value) : 0)}
                          className="mt-1.5"
                          placeholder="Ej: 50"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor={`partner_address_${index}`}>Dirección</Label>
                        <Input
                          id={`partner_address_${index}`}
                          value={partner.address || ''}
                          onChange={(e) => updatePartner(index, 'address', e.target.value)}
                          className="mt-1.5"
                          placeholder="Dirección del socio"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addPartner}>
                  <Plus className="mr-1 h-3 w-3" /> Agregar socio
                </Button>
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

        {processes.some((p) => {
          const def = getProcessDef(p.type)
          return p.state && def && def.fields.length > 0
        }) && (
          <div className="h-fit md:sticky md:top-6 space-y-4">
            {processes.map((p) => {
              const def = getProcessDef(p.type)
              const st = p.state ? states?.find((s) => s.abbreviation === p.state) : null
              if (!def || !def.fields.length || !st) return null
              return (
                <Card key={p.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">{def.label}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {st.name} ({st.abbreviation})
                    </p>
                    <StateClock timezone={getStateTimezone(st.abbreviation)} />
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-3">
                      {def.fields.map((f) => (
                        <div key={f.key} className="flex items-center justify-between text-sm">
                          <dt className="text-muted-foreground">{f.label}</dt>
                          <dd className="font-semibold">{formatFieldValue(getFieldValue(st, f.key), f.format)}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <AddProcessDialog
        open={showAddProcess}
        onOpenChange={setShowAddProcess}
        states={states}
        defaultState={formData.state}
        onAdd={addProcess}
      />
    </div>
  )
}
