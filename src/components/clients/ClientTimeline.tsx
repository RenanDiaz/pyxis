import { Card, CardContent } from '@/components/ui/card'
import { OUTCOME_CONFIG } from '@/components/calls/OutcomeBadge'
import { getClientPayments, getProcessLabel, parsePaymentDateParts } from '@/lib/processUtils'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Call, Client } from '@/types'
import { isToday, isYesterday, format } from 'date-fns'
import { es } from 'date-fns/locale'

type Tone = 'green' | 'blue' | 'gray'

interface TimelineEntry {
  date: Date
  /** El dato de origen es solo fecha (sin hora); no mostrar hora ni desfase de zona. */
  dateOnly: boolean
  title: string
  detail?: string
  tone: Tone
}

const DOT: Record<Tone, string> = {
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  gray: 'bg-muted-foreground',
}

function formatWhen(date: Date, dateOnly: boolean): string {
  const time = dateOnly ? '' : ` ${format(date, 'h:mm a', { locale: es })}`
  if (isToday(date)) return dateOnly ? 'Hoy' : `Hoy${time}`
  if (isYesterday(date)) return dateOnly ? 'Ayer' : `Ayer${time}`
  const day = format(date, "d 'de' MMM", { locale: es })
  return dateOnly ? day : `${day} ·${time}`
}

/**
 * Línea de tiempo de la relación con el cliente: pagos, llamadas y creación
 * en un solo hilo cronológico (más reciente primero).
 */
export default function ClientTimeline({ client, calls }: { client: Client; calls?: Call[] }) {
  const entries: TimelineEntry[] = []

  // Pagos y contratación de cada proceso, etiquetados con el servicio.
  if (client.processes?.length) {
    for (const process of client.processes) {
      const label = getProcessLabel(process)

      const contracted = process.created_at?.toDate?.()
      if (contracted) {
        entries.push({
          date: contracted,
          dateOnly: false,
          title: `Proceso contratado · ${label}`,
          tone: 'gray',
        })
      }

      for (const p of process.payments ?? []) {
        const parsed = parsePaymentDateParts(p.date)
        if (!parsed) continue
        entries.push({
          date: parsed.date,
          dateOnly: parsed.dateOnly,
          title: `Pago recibido · $${formatMoney(p.amount)}`,
          detail: [label, p.note].filter(Boolean).join(' · ') || undefined,
          tone: 'green',
        })
      }
    }
  } else {
    // Fallback legacy: pagos sueltos sin procesos.
    for (const p of getClientPayments(client)) {
      const parsed = parsePaymentDateParts(p.date)
      if (!parsed) continue
      entries.push({
        date: parsed.date,
        dateOnly: parsed.dateOnly,
        title: `Pago recibido · $${formatMoney(p.amount)}`,
        detail: p.note || undefined,
        tone: 'green',
      })
    }
  }

  for (const call of calls ?? []) {
    const d = call.scheduled_at?.toDate?.()
    if (!d) continue
    const outcome = OUTCOME_CONFIG[call.outcome]?.label ?? call.outcome
    entries.push({
      date: d,
      dateOnly: false,
      title: `Llamada · ${outcome}`,
      detail: call.notes || undefined,
      tone: 'blue',
    })
  }

  const created = client.created_at?.toDate?.()
  if (created) {
    entries.push({ date: created, dateOnly: false, title: 'Cliente creado', tone: 'gray' })
  }

  entries.sort((a, b) => b.date.getTime() - a.date.getTime())

  if (entries.length === 0) return null

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground/70">
          Línea de tiempo
        </p>
        <div className="space-y-4">
          {entries.map((e, i) => (
            <div key={i} className="flex gap-3">
              <span
                className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', DOT[e.tone])}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{e.title}</p>
                <p className="text-xs text-muted-foreground/70">
                  {formatWhen(e.date, e.dateOnly)}
                  {e.detail ? ` · ${e.detail}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
