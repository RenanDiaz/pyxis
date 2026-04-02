import { useParams, Link } from 'react-router-dom'
import { useStateByAbbreviation } from '@/hooks/useStates'
import { formatPrice, formatDays, formatYesNo } from '@/lib/format'
import { getStateTimezone } from '@/lib/timezones'
import StateClock from '@/components/states/StateClock'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export default function StateDetail() {
  const { abbreviation } = useParams<{ abbreviation: string }>()
  const { data: state, isLoading } = useStateByAbbreviation(abbreviation)

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
  const amendments = formatYesNo(state.amendments.available)
  const bpSpecific = formatYesNo(state.business_purpose.specific)
  const bpGeneral = formatYesNo(state.business_purpose.general)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/estados">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{state.name}</h1>
            <Badge variant="secondary" className="text-base">{state.abbreviation}</Badge>
          </div>
          <StateClock timezone={timezone} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pricing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Precio y costos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Precio de venta</p>
              <p className="text-3xl font-bold text-primary">{formatPrice(state.sale_price)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Fee del estado</p>
                <p className="text-lg font-semibold">{formatPrice(state.state_fee)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Días de proceso</p>
                <p className="text-lg font-semibold">{formatDays(state.processing_days)} días</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Annual Report */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reporte anual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Fee</p>
              <p className="text-lg font-semibold">{formatPrice(state.annual_report.fee)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha de vencimiento</p>
              <p className="text-lg font-semibold">
                {state.annual_report.due_date && !state.annual_report.due_date.startsWith('Columna')
                  ? state.annual_report.due_date
                  : 'No disponible'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dissolution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Disolución</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Fee</p>
                <p className="text-lg font-semibold">{formatPrice(state.dissolution.fee)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Días de proceso</p>
                <p className="text-lg font-semibold">{formatDays(state.dissolution.processing_days)} días</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Amendments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Enmiendas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Disponible</p>
              <Badge variant={amendments.positive ? 'default' : 'secondary'}>
                {amendments.label}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fee</p>
              <p className="text-lg font-semibold">{formatPrice(state.amendments.fee)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Business Purpose */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Propósito del negocio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Específico</p>
                <Badge variant={bpSpecific.positive ? 'default' : 'secondary'}>
                  {bpSpecific.label}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">General</p>
                <Badge variant={bpGeneral.positive ? 'default' : 'secondary'}>
                  {bpGeneral.label}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Codes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Códigos de referencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Códigos postales (ZIP codes)</p>
              <p className="text-lg font-semibold font-mono break-words">
                {state.zip_code_range.split(',').map((range, i) => {
                  const trimmed = range.trim()
                  const [start, end] = trimmed.split('-')
                  return (
                    <span key={i}>
                      {i > 0 && <span className="text-muted-foreground">, </span>}
                      {start.padEnd(5, '0')}–{end.padEnd(5, '9')}
                    </span>
                  )
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Los ZIP codes de este estado empiezan con estos números
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Códigos de área telefónicos</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {state.area_codes.map((code) => (
                  <Badge key={code} variant="outline" className="font-mono text-sm px-2.5 py-0.5">
                    ({code})
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Ej: <span className="font-mono">+1 ({state.area_codes[0]}) 555-1234</span> — los 3 dígitos después del +1
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Name Check */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Verificación de nombre</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href={state.name_check_link} target="_blank" rel="noopener noreferrer">
                Verificar disponibilidad
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
