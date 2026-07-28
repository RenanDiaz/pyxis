import { useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PROCESSES } from '@/data/processes'
import type { ClientProcess, ProcessType, StateInfo } from '@/types'

interface AddProcessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  states?: StateInfo[]
  defaultState?: string
  /** Nombre de LLC del cliente, usado como sugerencia para el primer registro. */
  defaultLlcName?: string
  onAdd: (process: ClientProcess) => void
}

export default function AddProcessDialog({
  open,
  onOpenChange,
  states,
  defaultState,
  defaultLlcName,
  onAdd,
}: AddProcessDialogProps) {
  const [type, setType] = useState<ProcessType | ''>('')
  const [customLabel, setCustomLabel] = useState('')
  const [stateAbbr, setStateAbbr] = useState<string>(defaultState ?? '')
  const [llcName, setLlcName] = useState('')

  const isCustom = type === 'custom'
  const isRegistration = type === 'registration'
  const canAdd = !!type && (!isCustom || customLabel.trim().length > 0)

  const reset = () => {
    setType('')
    setCustomLabel('')
    setStateAbbr(defaultState ?? '')
    setLlcName('')
  }

  const handleAdd = () => {
    if (!canAdd || !type) return
    const process: ClientProcess = {
      id: crypto.randomUUID(),
      type,
      payments: [],
      stage: 'pendiente',
      created_at: Timestamp.now(),
      ...(isCustom ? { custom_label: customLabel.trim() } : {}),
      ...(stateAbbr ? { state: stateAbbr } : {}),
      ...(isRegistration && llcName.trim() ? { llc_name: llcName.trim() } : {}),
    }
    onAdd(process)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar proceso</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Proceso</Label>
            <Select value={type} onValueChange={(v) => setType(v as ProcessType)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un proceso" />
              </SelectTrigger>
              <SelectContent>
                {PROCESSES.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Otro (proceso personalizado)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCustom && (
            <div className="space-y-1.5">
              <Label htmlFor="custom-process-name">Nombre del proceso</Label>
              <Input
                id="custom-process-name"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Ej: Certificado de buena conducta"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Proceso extraordinario: solo aplica a este cliente, no queda en la lista de procesos.
              </p>
            </div>
          )}

          {isRegistration && (
            <div className="space-y-1.5">
              <Label htmlFor="process-llc-name">Nombre de la LLC</Label>
              <Input
                id="process-llc-name"
                value={llcName}
                onChange={(e) => setLlcName(e.target.value)}
                placeholder={defaultLlcName || 'Ej: SUNRISE SERVICES LLC'}
              />
              <p className="text-xs text-muted-foreground">
                Cada registro es una compañía distinta y genera su propio documento Word.
                {defaultLlcName ? ` Si lo dejas vacío se usa "${defaultLlcName}".` : ''}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select
              value={stateAbbr || '_none'}
              onValueChange={(v) => setStateAbbr(v === '_none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sin estado</SelectItem>
                {states?.map((s) => (
                  <SelectItem key={s.abbreviation} value={s.abbreviation}>
                    {s.name} ({s.abbreviation})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAdd} disabled={!canAdd}>Agregar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
