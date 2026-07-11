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
  onAdd: (process: ClientProcess) => void
}

export default function AddProcessDialog({
  open,
  onOpenChange,
  states,
  defaultState,
  onAdd,
}: AddProcessDialogProps) {
  const [type, setType] = useState<ProcessType | ''>('')
  const [stateAbbr, setStateAbbr] = useState<string>(defaultState ?? '')

  const reset = () => {
    setType('')
    setStateAbbr(defaultState ?? '')
  }

  const handleAdd = () => {
    if (!type) return
    const process: ClientProcess = {
      id: crypto.randomUUID(),
      type,
      payments: [],
      stage: 'pendiente',
      created_at: Timestamp.now(),
      ...(stateAbbr ? { state: stateAbbr } : {}),
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
              </SelectContent>
            </Select>
          </div>

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
          <Button onClick={handleAdd} disabled={!type}>Agregar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
