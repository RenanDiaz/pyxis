import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStates } from '@/hooks/useStates'
import { formatPrice, formatDays } from '@/lib/format'
import { getStateTimezone } from '@/lib/timezones'
import { getSpanishName } from '@/lib/stateNamesEs'
import { filterStates } from '@/lib/stateSearch'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, Clock, LayoutGrid, Map } from 'lucide-react'
import StatesMap from '@/components/StatesMap'

type ViewMode = 'cards' | 'map'

const STORAGE_KEY = 'pyxis-states-view'

function getInitialView(): ViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'cards' || stored === 'map') return stored
  } catch {}
  return 'cards'
}

export default function States() {
  const { data: states, isLoading } = useStates()
  const [search, setSearch] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [view, setView] = useState<ViewMode>(getInitialView)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, view)
    } catch {}
  }, [view])

  const filtered = useMemo(() => {
    if (!states) return []
    return filterStates(states, search)
  }, [states, search])

  if (isLoading) {
    return <p className="text-muted-foreground">Cargando estados...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Estados</h1>
          <div className="flex items-center rounded-lg border bg-muted p-0.5">
            <Button
              variant={view === 'cards' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setView('cards')}
              title="Vista de tarjetas"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'map' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setView('map')}
              title="Vista de mapa"
            >
              <Map className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nombre, abreviatura, ZIP o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {view === 'map' ? (
        <StatesMap states={states ?? []} search={search} filteredStates={filtered} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((state) => {
              const tz = getStateTimezone(state.abbreviation)
              const time = formatInTimeZone(now, tz, 'h:mm a', { locale: es })
              const spanishName = getSpanishName(state.name)

              return (
                <Link key={state.abbreviation} to={`/estados/${state.abbreviation}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{state.name}</h3>
                            <Badge variant="secondary">{state.abbreviation}</Badge>
                          </div>
                          {spanishName && (
                            <p className="text-sm text-muted-foreground">{spanishName}</p>
                          )}
                          <p className="text-2xl font-bold text-primary mt-1">
                            {formatPrice(state.sale_price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Clock className="h-3 w-3" />
                          <span>{time}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                        <span>Fee: {formatPrice(state.state_fee)}</span>
                        <span>{formatDays(state.processing_days)} días</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No se encontraron estados para "{search}"
            </p>
          )}
        </>
      )}
    </div>
  )
}
