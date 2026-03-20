import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CallOutcome } from '@/types'

const OUTCOME_CONFIG: Record<CallOutcome, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/30' },
  completada: { label: 'Completada', className: 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/30' },
  no_contesto: { label: 'No contesto', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-gray-800/30 dark:text-gray-400 dark:hover:bg-gray-800/30' },
  reagendada: { label: 'Reagendada', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/30' },
}

export default function OutcomeBadge({ outcome }: { outcome: CallOutcome }) {
  const config = OUTCOME_CONFIG[outcome]
  return (
    <Badge variant="secondary" className={cn(config.className)}>
      {config.label}
    </Badge>
  )
}

export { OUTCOME_CONFIG }
