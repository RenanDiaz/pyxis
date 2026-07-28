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
import PaymentSection, { type PaymentEvent } from '@/components/clients/PaymentSection'
import {
  getProcessDef,
  getProcessLabel,
  getFieldValue,
  formatFieldValue,
  getSuggestedPrice,
  hasRegisteredAgent,
  PROCESS_STAGE_LABELS,
} from '@/lib/processUtils'
import { exportRegistrationDoc, getProcessCompanyName } from '@/lib/exportClientDoc'
import type { Client, ClientProcess, ProcessStage, StateInfo, Workspace } from '@/types'

const STAGE_ORDER: ProcessStage[] = ['pendiente', 'en_proceso', 'completado', 'cancelado']

/** Campos de compañía que un registro de LLC puede sobrescribir del cliente. */
const COMPANY_KEYS = ['llc_name', 'business_address', 'business_purpose'] as const

type CompanyDraft = Record<(typeof COMPANY_KEYS)[number], string>

interface ProcessCardProps {
  client: Client
  process: ClientProcess
  state?: StateInfo | null
  onUpdate: (process: ClientProcess, event?: PaymentEvent) => Promise<void>
  onRemove: () => void
  isPending: boolean
  workspace?: Workspace | null
}

export default function ProcessCard({
  client,
  process,
  state,
  onUpdate,
  onRemove,
  isPending,
  workspace,
}: ProcessCardProps) {
  const def = getProcessDef(process.type)
  const stateFields = def?.fields ?? []
  const showStateInfo = stateFields.length > 0 && !!state
  const isRegistration = process.type === 'registration'

  const [notes, setNotes] = useState<string | null>(null)
  const currentNotes = notes ?? process.notes ?? ''

  // Datos de la compañía de ESTE registro. Vacío = hereda los del cliente.
  const [company, setCompany] = useState<CompanyDraft | null>(null)
  const currentCompany: CompanyDraft = company ?? {
    llc_name: process.llc_name ?? '',
    business_address: process.business_address ?? '',
    business_purpose: process.business_purpose ?? '',
  }

  const handleSaveCompany = async () => {
    const next: ClientProcess = { ...process }
    for (const key of COMPANY_KEYS) {
      const value = currentCompany[key].trim()
      if (value) {
        next[key] = value
      } else {
        // Firestore rechaza `undefined`: quitamos la clave para volver al
        // valor heredado del cliente.
        delete next[key]
      }
    }
    await onUpdate(next)
    setCompany(null)
  }

  const handleExport = async () => {
    try {
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
            onValueChange={(v) => onUpdate({ ...process, stage: v as ProcessStage })}
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
                  placeholder={client.llc_name || 'Ej: SUNRISE SERVICES LLC'}
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
                  placeholder={client.business_address || 'Dirección de esta compañía'}
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
                  placeholder={client.business_purpose || 'Propósito de esta compañía'}
                  rows={2}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Si dejas un campo vacío se usa el dato del cliente. Estos datos son los que salen
                en el documento Word de esta compañía.
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
                  onUpdate({ ...process, has_registered_agent: checked })
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
          onUpdate={onUpdate}
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
              await onUpdate({ ...process, notes: currentNotes })
              setNotes(null)
            }}
          >
            Guardar notas
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
