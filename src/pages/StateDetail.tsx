import { useParams, Link, useNavigate } from 'react-router-dom'
import { useStateByAbbreviation, useStates } from '@/hooks/useStates'
import { formatPrice, formatDays, formatYesNo } from '@/lib/format'
import { getStateTimezone, getTimezoneLabel } from '@/lib/timezones'
import { useNow } from '@/hooks/useNow'
import { isGoodCallTime, getCallTimeLabel, formatLocalTime } from '@/lib/callTime'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ArrowLeft, ExternalLink, Search } from 'lucide-react'

export default function StateDetail() {
  const { abbreviation } = useParams<{ abbreviation: string }>()
  const navigate = useNavigate()
  const { data: state, isLoading } = useStateByAbbreviation(abbreviation)
  const { data: states } = useStates()
  const now = useNow(1000)

  if (isLoading) {
    return <p className="text-muted-foreground">Cargando...</p>
  }

  if (!state) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Estado no encontrado</p>
        <Link to="/estados" className="text-primary underline mt-2 inline-block">
          Volver a estados
        </Link>
      </div>
    )
  }

  const timezone = getStateTimezone(state.abbreviation)
  const tzLabel = getTimezoneLabel(timezone)
  const localTime = formatLocalTime(now, timezone, 'h:mm a')
  const goodTime = isGoodCallTime(now, timezone)
  const callLabel = getCallTimeLabel(now, timezone)

  const amendments = formatYesNo(state.amendments.available)
  const bpSpecific = formatYesNo(state.business_purpose.specific)
  const bpGeneral = formatYesNo(state.business_purpose.general)
  const dueDate =
    state.annual_report.due_date && !state.annual_report.due_date.startsWith('Columna')
      ? state.annual_report.due_date
      : 'No disponible'

  const sortedStates = (states ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-4">
      {/* Header — modo llamada: nombre, reloj local con semáforo, acciones */}
      <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/estados" className="shrink-0">
              <Button variant="outline" size="icon" className="rounded-xl" aria-label="Volver a estados">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight">{state.name}</h1>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-sm font-bold text-secondary-foreground">
                  {state.abbreviation}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                    goodTime
                      ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400'
                      : 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  <span className="relative flex h-2 w-2">
                    {goodTime && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                    )}
                    <span
                      className={cn(
                        'relative inline-flex h-2 w-2 rounded-full',
                        goodTime ? 'bg-green-500' : 'bg-muted-foreground',
                      )}
                    />
                  </span>
                  {callLabel}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Hora local del cliente ·{' '}
                <strong className="tabular-nums text-foreground">{localTime}</strong>{' '}
                <span className="text-muted-foreground/70">({tzLabel})</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-[190px]">
              <Select value={state.abbreviation} onValueChange={(v) => navigate(`/estados/${v}`)}>
                <SelectTrigger className="h-10 rounded-xl text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    <SelectValue placeholder="Cambiar de estado…" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {sortedStates.map((s) => (
                    <SelectItem key={s.abbreviation} value={s.abbreviation}>
                      {s.name} ({s.abbreviation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button asChild className="h-10 rounded-xl shadow-md shadow-primary/30">
              <a href={state.name_check_link} target="_blank" rel="noopener noreferrer">
                Verificar nombre
                <ExternalLink className="ml-1 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* HERO: los tres números que el agente cita */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#4f46e5,#6366f1)] p-6 text-white sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-semibold text-indigo-100">Precio de venta</p>
          <p className="mt-1 text-5xl font-extrabold leading-none tracking-tight">
            {formatPrice(state.sale_price)}
          </p>
          <p className="mt-3 text-xs text-indigo-100">Precio que cotizas al cliente</p>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <p className="text-sm font-semibold text-muted-foreground">Fee del estado</p>
          <p className="mt-1 text-4xl font-extrabold leading-none tracking-tight">
            {formatPrice(state.state_fee)}
          </p>
          <p className="mt-3 text-xs text-muted-foreground/70">Costo oficial</p>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <p className="text-sm font-semibold text-muted-foreground">Días de proceso</p>
          <p className="mt-1 text-4xl font-extrabold leading-none tracking-tight">
            {formatDays(state.processing_days)}
          </p>
          <p className="mt-3 text-xs text-muted-foreground/70">Tiempo estimado</p>
        </div>
      </div>

      {/* Detalles del estado — comprimidos y escaneables */}
      <p className="pt-2 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground/70">
        Detalles del estado
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Reporte anual */}
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground/70">Reporte anual</p>
          <div className="flex justify-between py-0.5 text-sm">
            <span className="text-muted-foreground">Fee</span>
            <span className="font-bold">{formatPrice(state.annual_report.fee)}</span>
          </div>
          <div className="flex justify-between py-0.5 text-sm">
            <span className="text-muted-foreground">Vence</span>
            <span className="font-bold">{dueDate}</span>
          </div>
        </div>

        {/* Disolución */}
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground/70">Disolución</p>
          <div className="flex justify-between py-0.5 text-sm">
            <span className="text-muted-foreground">Fee</span>
            <span className="font-bold">{formatPrice(state.dissolution.fee)}</span>
          </div>
          <div className="flex justify-between py-0.5 text-sm">
            <span className="text-muted-foreground">Días</span>
            <span className="font-bold">{formatDays(state.dissolution.processing_days)}</span>
          </div>
        </div>

        {/* Enmiendas */}
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground/70">Enmiendas</p>
          <div className="flex items-center justify-between py-0.5 text-sm">
            <span className="text-muted-foreground">Disponible</span>
            <span
              className={cn(
                'rounded px-2 py-0.5 text-[11px] font-bold',
                amendments.positive
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {amendments.label}
            </span>
          </div>
          <div className="flex justify-between py-0.5 text-sm">
            <span className="text-muted-foreground">Fee</span>
            <span className="font-bold">{formatPrice(state.amendments.fee)}</span>
          </div>
        </div>

        {/* Propósito del negocio */}
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground/70">Propósito del negocio</p>
          <div className="flex flex-wrap gap-1.5">
            <span
              className={cn(
                'rounded px-2 py-0.5 text-[11px] font-semibold',
                bpSpecific.positive
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              Específico · {bpSpecific.label}
            </span>
            <span
              className={cn(
                'rounded px-2 py-0.5 text-[11px] font-semibold',
                bpGeneral.positive
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              General · {bpGeneral.label}
            </span>
          </div>
        </div>

        {/* Códigos de área */}
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground/70">Códigos de área</p>
          <div className="flex flex-wrap gap-1.5">
            {state.area_codes.map((code) => (
              <span
                key={code}
                className="rounded border px-2 py-0.5 font-mono text-xs"
              >
                {code}
              </span>
            ))}
          </div>
        </div>

        {/* ZIP codes */}
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground/70">ZIP codes</p>
          <p className="font-mono text-sm font-bold break-words">
            {state.zip_code_range.split(',').map((range, i) => {
              const trimmed = range.trim()
              const [start, end] = trimmed.split('-')
              return (
                <span key={i}>
                  {i > 0 && <span className="text-muted-foreground">, </span>}
                  {start.padEnd(5, '0')}–{(end ?? start).padEnd(5, '9')}
                </span>
              )
            })}
          </p>
        </div>
      </div>
    </div>
  )
}
