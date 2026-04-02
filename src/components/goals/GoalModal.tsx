import { useState } from 'react'
import { format } from 'date-fns'
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
import { useCreateGoal } from '@/hooks/useGoals'
import type { GoalType } from '@/types'

interface GoalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetUid: string
  teamId: string | null
  targetName?: string
}

export default function GoalModal({
  open,
  onOpenChange,
  targetUid,
  teamId,
  targetName,
}: GoalModalProps) {
  const [type, setType] = useState<GoalType>('daily')
  const [value, setValue] = useState('')
  const createGoal = useCreateGoal()

  const defaultDailyPeriod = format(new Date(), 'yyyy-MM-dd')
  const defaultMonthlyPeriod = format(new Date(), 'yyyy-MM')

  const handleSubmit = async () => {
    const numValue = parseInt(value, 10)
    if (!numValue || numValue <= 0) return

    await createGoal.mutateAsync({
      target_uid: targetUid,
      team_id: teamId,
      type,
      value: numValue,
      period: type === 'daily' ? defaultDailyPeriod : defaultMonthlyPeriod,
    })

    setValue('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Definir meta{targetName ? ` — ${targetName}` : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de meta</Label>
            <Select value={type} onValueChange={(v) => setType(v as GoalType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diaria</SelectItem>
                <SelectItem value="monthly">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Período</Label>
            <Input
              value={type === 'daily' ? defaultDailyPeriod : defaultMonthlyPeriod}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label>Meta de ventas (número de clientes cerrados)</Label>
            <Input
              type="number"
              min={1}
              placeholder="Ej: 5"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!value || parseInt(value, 10) <= 0 || createGoal.isPending}
          >
            {createGoal.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
