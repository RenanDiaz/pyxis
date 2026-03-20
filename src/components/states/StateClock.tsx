import { useEffect, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { getTimezoneLabel } from '@/lib/timezones'
import { Clock } from 'lucide-react'

interface StateClockProps {
  timezone: string
}

export default function StateClock({ timezone }: StateClockProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const time = formatInTimeZone(now, timezone, 'h:mm:ss a', { locale: es })
  const label = getTimezoneLabel(timezone)

  return (
    <div className="flex items-center gap-2 text-sm">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">{time}</span>
      <span className="text-muted-foreground">({label})</span>
    </div>
  )
}
