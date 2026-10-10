import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileDown, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import StateClock from '@/components/states/StateClock'
import { getStateTimezone } from '@/lib/timezones'
import PaymentSection from '@/components/clients/PaymentSection'
import { clientMutations, type ProcessPatch, type RunClientMutation } from '@/lib/processMutations'
import {
  getProcessDef,
  getProcessLabel,
  getFieldValue,
  formatFieldValue,
  getSuggestedPrice,
  getProcessSaleDate,
  getProcessStateCost,
  hasRegisteredAgent,
  localDateKey,
  PROCESS_STAGE_LABELS,
} from '@/lib/processUtils'
import {
  COMPANY_KEYS,
  getProcessCompanyName,
  inheritsClientCompany,
  type CompanyKey,
} from '@/lib/companyUtils'
import type { Client, ClientProcess, ProcessStage, StateInfo, Workspace } from '@/types'
import { UPPERCASE_INPUT_CLASS } from '@/lib/clientUtils'

const STAGE_ORDER: ProcessStage[] = ['pendiente', 'en_proceso', 'completado', 'cancelado']

type CompanyDraft = Record<CompanyKey, string>

interface ProcessCardProps {
  client: Client
  process: ClientProcess
  state?: StateInfo | null
  /** Aplica cambios al proceso de forma transaccional (sobre el doc actual). */
  onMutate: RunClientMutation
  onRemove: () => void
  isPending: boolean
  workspace?: Workspace | null
}

export default function ProcessCard({
  client,
  process,
  state,
  onMutate,
  onRemove,
  isPending,
  workspace,
}: ProcessCardProps) {
  const def = getProcessDef(process.type)
  const stateFields = def?.fields ?? []
  const showStateInfo = stateFields.length > 0 && !!state
  const isRegistration = process.type === 'registration'
  // Solo el primer registro hereda los datos de compañía del cliente; los demás
  // muestran únicamente los suyos para no repetir la misma compañía en cada card.
  const inheritsCompany = inheritsClientCompany(client, process)

  // Fecha de venta: borrador local mientras se edita; se guarda al salir del campo.
  const [soldAt, setSoldAt] = useState<string | null>(null)
  const saleDate = getProcessSaleDate(process)
  const savedSoldAt = saleDate ? localDateKey(saleDate) : ''
  const currentSoldAt = soldAt ?? savedSoldAt
  const today = localDateKey(new Date())

  const saveSoldAt = async () => {
    if (soldAt === null) return
    // Borrar la fecha vuelve a contar la venta en el mes del primer pago.
    if (soldAt === '' && process.sold_at) {
      if (await updateProcess({ sold_at: undefined }, 'Fecha de venta quitada')) setSoldAt(null)
      return
    }
    // Fecha incompleta, futura o sin cambios: se descarta el borrador.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(soldAt) || soldAt > today || soldAt === process.sold_at) {
      setSoldAt(null)
      return
    }
    if (await updateProcess({ sold_at: soldAt }, 'Fecha de venta actualizada')) setSoldAt(null)
  }

  // Costo estatal (STATE FEE del reporte): el capturado en el proceso o, si no,
  // el del catálogo / estado. Borrador local; se guarda al salir del campo.
  const [stateCost, setStateCost] = useState<string | null>(null)
  const defaultCost = getProcessStateCost({ ...process, state_cost: undefined }, state)
  const hasOwnCost = typeof process.state_cost === 'number'
  const savedCost = hasOwnCost ? process.state_cost : defaultCost.cost
  const currentCost = stateCost ?? (savedCost == null ? '' : String(savedCost))

  const saveStateCost = async () => {
    if (stateCost === null) return
    const trimmed = stateCost.trim()
    // Vacío vuelve al costo del catálogo / estado.
    if (trimmed === '') {
      if (hasOwnCost && (await updateProcess({ state_cost: undefined }, 'Costo estatal restablecido'))) {
        setStateCost(null)
      } else if (!hasOwnCost) setStateCost(null)
      return
    }
    const num = parseFloat(trimmed)
    // Inválido o sin cambios: se descarta. Igual al default sin captura previa:
    // no se fija, para que siga al estado si este cambia.
    if (isNaN(num) || num < 0 || num === savedCost) {
      setStateCost(null)
      return
    }
    if (await updateProcess({ state_cost: num }, 'Costo estatal actualizado')) setStateCost(null)
  }

  // Reembolso (solo cancelados): cuánto se le devolvió al cliente (spec 04, P3).
  const isCancelled = process.stage === 'cancelado'
  const [refund, setRefund] = useState<string | null>(null)
  const currentRefund = refund ?? (typeof process.refunded_amount === 'number' ? String(process.refunded_amount) : '')

  const saveRefund = async () => {
    if (refund === null) return
    const trimmed = refund.trim()
    const num = trimmed === '' ? undefined : parseFloat(trimmed)
    // Inválido o sin cambios: se descarta el borrador.
    if ((num !== undefined && (isNaN(num) || num < 0)) || num === process.refunded_amount) {
      setRefund(null)
      return
    }
    const message = num === undefined ? 'Reembolso quitado' : 'Reembolso actualizado'
    if (await updateProcess({ refunded_amount: num }, message)) setRefund(null)
  }

  const [notes, setNotes] = useState<string | null>(null)
  const currentNotes = notes ?? process.notes ?? ''

  // Datos de la compañía de ESTE registro.
  const [company, setCompany] = useState<CompanyDraft | null>(null)
  const currentCompany: CompanyDraft = company ?? {
    llc_name: process.llc_name ?? '',
    business_address: process.business_address ?? '',
    business_purpose: process.business_purpose ?? '',
  }

  const updateProcess = (patch: ProcessPatch, successMessage: string) =>
    onMutate(clientMutations.updateProcess(process.id, patch), successMessage)

  const handleSaveCompany = async () => {
    const patch: ProcessPatch = {}
    for (const key of COMPANY_KEYS) {
      // Vacío ⇒ `undefined`: se quita la clave y vuelve al valor heredado.
      patch[key] = currentCompany[key].trim() || undefined
    }
    if (await updateProcess(patch, 'Datos de la compañía guardados')) setCompany(null)
  }

  const handleExport = async () => {
    try {
      const { exportRegistrationDoc } = await import('@/lib/exportClientDoc')
      await exportRegistrationDoc(client, process)
    } catch {
      toast.error('No se pudo generar el documento')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-medium">
              {getProcessLabel(process)}
              {process.state ? ` — ${process.state}` : ''}
            </CardTitle>
            {isRegistration && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {getProcessCompanyName(client, process) || 'Compañía sin nombre'}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isRegistration && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={handleExport}
                title="Exportar el documento Word de esta compañía"
              >
                <FileDown className="mr-1 h-3 w-3" />
                .docx
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onRemove}
              disabled={isPending}
              title="Quitar proceso"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Etapa</span>
          <Select
            value={process.stage}
            onValueChange={(v) => updateProcess({ stage: v as ProcessStage }, 'Etapa actualizada')}
          >
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGE_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {PROCESS_STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Label htmlFor={`sold-at-${process.id}`} className="text-xs font-normal text-muted-foreground">
            Venta
          </Label>
          <Input
            id={`sold-at-${process.id}`}
            type="date"
            max={today}
            className="h-8 w-[160px]"
            value={currentSoldAt}
            onChange={(e) => setSoldAt(e.target.value)}
            onBlur={saveSoldAt}
            title="Mes en que el reporte de ventas cuenta este proceso"
          />
          {!process.sold_at && (
            <span className="text-xs text-muted-foreground">
              {saleDate ? 'según el primer pago' : 'sin pagos aún'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Label htmlFor={`state-cost-${process.id}`} className="text-xs font-normal text-muted-foreground">
            Costo estatal ($)
          </Label>
          <Input
            id={`state-cost-${process.id}`}
            type="number"
            min={0}
            step="0.01"
            className="h-8 w-[110px]"
            value={currentCost}
            placeholder="—"
            onChange={(e) => setStateCost(e.target.value)}
            onBlur={saveStateCost}
            title="STATE FEE del reporte de ventas: lo que cobra el estado o el proveedor"
          />
          <span className="text-xs text-muted-foreground">
            {hasOwnCost
              ? 'capturado'
              : defaultCost.reason === 'manual'
                ? 'sin capturar'
                : defaultCost.reason === 'no_state'
                  ? 'falta el estado'
                  : defaultCost.reason === 'no_state_value'
                    ? 'el estado no lo tiene'
                    : 'del catálogo'}
          </span>
        </div>
        {isCancelled && (
          <div className="flex items-center gap-2 pt-1">
            <Label htmlFor={`refund-${process.id}`} className="text-xs font-normal text-muted-foreground">
              Reembolsado ($)
            </Label>
            <Input
              id={`refund-${process.id}`}
              type="number"
              min={0}
              step="0.01"
              className="h-8 w-[110px]"
              value={currentRefund}
              placeholder="—"
              onChange={(e) => setRefund(e.target.value)}
              onBlur={saveRefund}
              title="Cuánto se le devolvió al cliente: el reporte de ventas cuenta lo cobrado menos esto"
            />
            <span className="text-xs text-muted-foreground">
              {typeof process.refunded_amount === 'number' ? 'capturado' : 'sin capturar (pon 0 si no se devolvió nada)'}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isRegistration && (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Datos de la compañía</p>
              <div className="space-y-1.5">
                <Label htmlFor={`llc-name-${process.id}`} className="text-xs">
                  Nombre de la LLC
                </Label>
                <Input
                  id={`llc-name-${process.id}`}
                  value={currentCompany.llc_name}
                  onChange={(e) => setCompany({ ...currentCompany, llc_name: e.target.value })}
                  className={UPPERCASE_INPUT_CLASS}
                  placeholder={
                    (inheritsCompany ? client.llc_name : '') || 'Ej: SUNRISE SERVICES LLC'
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`business-address-${process.id}`} className="text-xs">
                  Dirección comercial
                </Label>
                <Textarea
                  id={`business-address-${process.id}`}
                  value={currentCompany.business_address}
                  onChange={(e) => setCompany({ ...currentCompany, business_address: e.target.value })}
                  className={UPPERCASE_INPUT_CLASS}
                  placeholder={
                    (inheritsCompany ? client.business_address : '') || 'Dirección de esta compañía'
                  }
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`business-purpose-${process.id}`} className="text-xs">
                  Propósito del negocio
                </Label>
                <Textarea
                  id={`business-purpose-${process.id}`}
                  value={currentCompany.business_purpose}
                  onChange={(e) => setCompany({ ...currentCompany, business_purpose: e.target.value })}
                  className={UPPERCASE_INPUT_CLASS}
                  placeholder={
                    (inheritsCompany ? client.business_purpose : '') || 'Propósito de esta compañía'
                  }
                  rows={2}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {inheritsCompany
                  ? 'Si dejas un campo vacío se usa el dato del cliente. Estos datos son los que salen en el documento Word de esta compañía.'
                  : 'Estos datos son solo de esta compañía y son los que salen en su documento Word.'}
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={company === null || isPending}
                onClick={handleSaveCompany}
              >
                Guardar datos de la compañía
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <Label htmlFor={`registered-agent-${process.id}`} className="text-sm font-medium">
                  Registered Agent
                </Label>
                <p className="text-xs text-muted-foreground">
                  {hasRegisteredAgent(process) ? 'Incluido en el registro' : 'No incluido'}
                </p>
              </div>
              <Switch
                id={`registered-agent-${process.id}`}
                checked={hasRegisteredAgent(process)}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  updateProcess({ has_registered_agent: checked }, 'Registered Agent actualizado')
                }
              />
            </div>
            <Separator />
          </>
        )}

        {showStateInfo && state && (
          <>
            <StateClock timezone={getStateTimezone(state.abbreviation)} />
            <dl className="grid gap-3">
              {stateFields.map((f) => (
                <div key={f.key} className="flex items-center justify-between text-sm">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="font-semibold">{formatFieldValue(getFieldValue(state, f.key), f.format)}</dd>
                </div>
              ))}
            </dl>
            <Separator />
          </>
        )}

        <PaymentSection
          client={client}
          process={process}
          onMutate={onMutate}
          isPending={isPending}
          suggestedTotal={process.total ? null : getSuggestedPrice(process.type, state)}
          workspace={workspace}
        />

        <Separator />
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Notas del proceso</p>
          <Textarea
            value={currentNotes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: periódicos asignados, número de publicación, observaciones..."
            rows={3}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={notes === null || isPending}
            onClick={async () => {
              if (await updateProcess({ notes: currentNotes }, 'Notas guardadas')) setNotes(null)
            }}
          >
            Guardar notas
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
