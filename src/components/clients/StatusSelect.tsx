import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ClientStatus } from '@/types'
import { STATUS_CONFIG } from './StatusBadge'

interface StatusSelectProps {
  value: ClientStatus
  onChange: (value: ClientStatus) => void
}

const ALL_STATUSES: ClientStatus[] = ['nuevo', 'contactado', 'en_proceso', 'cerrado', 'perdido']

export default function StatusSelect({ value, onChange }: StatusSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ClientStatus)}>
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ALL_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <span className={STATUS_CONFIG[s].className.replace(/hover:\S+/g, '').trim() + ' px-1.5 py-0.5 rounded text-xs font-medium'}>
              {STATUS_CONFIG[s].label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
