import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Trash2 } from 'lucide-react'
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
import type { Client, ClientProcess, ProcessStage, StateInfo, Workspace } from '@/types'

const STAGE_ORDER: ProcessStage[] = ['pendiente', 'en_proceso', 'completado', 'cancelado']

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

  const [notes, setNotes] = useState<string | null>(null)
  const currentNotes = notes ?? process.notes ?? ''

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-medium">
              {getProcessLabel(process.type)}
              {process.state ? ` — ${process.state}` : ''}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
            onClick={onRemove}
            disabled={isPending}
            title="Quitar proceso"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
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
        {process.type === 'registration' && (
          <>
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
