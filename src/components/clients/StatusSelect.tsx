import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ClientStatus } from '@/types'
import { STATUS_CONFIG, StatusLabel } from './StatusBadge'

interface StatusSelectProps {
  value: ClientStatus
  onChange: (value: ClientStatus) => void
}

const ALL_STATUSES: ClientStatus[] = ['nuevo', 'contactado', 'en_proceso', 'cerrado', 'perdido', 'deuda_pendiente']

export default function StatusSelect({ value, onChange }: StatusSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ClientStatus)}>
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ALL_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <span className={STATUS_CONFIG[s].className.replace(/hover:\S+/g, '').trim() + ' inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium'}>
              <StatusLabel status={s} />
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
