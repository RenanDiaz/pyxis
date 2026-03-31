import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps'
import type { StateInfo } from '@/types'
import { formatPrice, formatDays } from '@/lib/format'

// Pre-projected AlbersUSA topology — includes Alaska & Hawaii insets
import statesAlbers from 'us-atlas/states-albers-10m.json'

interface StatesMapProps {
  states: StateInfo[]
  search: string
  filteredStates: StateInfo[]
}

export default function StatesMap({ states, search, filteredStates }: StatesMapProps) {
  const navigate = useNavigate()
  const [tooltip, setTooltip] = useState<{
    state: StateInfo
    x: number
    y: number
  } | null>(null)

  // Lookup by state name (geography name → StateInfo)
  const statesByName = useMemo(() => {
    const map = new Map<string, StateInfo>()
    for (const s of states) {
      map.set(s.name, s)
    }
    return map
  }, [states])

  // Set of filtered abbreviations for search highlighting
  const filteredAbbrs = useMemo(() => {
    return new Set(filteredStates.map((s) => s.abbreviation))
  }, [filteredStates])

  const hasSearch = search.trim().length > 0
  const exactMatch = hasSearch && filteredStates.length === 1 ? filteredStates[0] : null

  const getFill = useCallback(
    (abbr: string | undefined) => {
      if (!abbr) return 'var(--color-muted)'
      if (hasSearch && filteredAbbrs.has(abbr)) return 'var(--color-primary)'
      return 'var(--color-muted)'
    },
    [hasSearch, filteredAbbrs],
  )

  const getStroke = useCallback(
    (abbr: string | undefined) => {
      if (abbr && hasSearch && filteredAbbrs.has(abbr)) return 'var(--color-primary-foreground)'
      return 'var(--color-border)'
    },
    [hasSearch, filteredAbbrs],
  )

  const getOpacity = useCallback(
    (abbr: string | undefined) => {
      if (abbr && hasSearch && filteredAbbrs.has(abbr)) return 0.7
      return 1
    },
    [hasSearch, filteredAbbrs],
  )

  return (
    <div className="relative">
      {/* Mobile hint */}
      <p className="sm:hidden text-xs text-muted-foreground text-center mb-2">
        Tip: en pantallas pequeñas la vista de tarjetas es más fácil de usar
      </p>

      <div className="w-full border rounded-lg bg-card overflow-hidden">
        <ComposableMap
          projection="geoIdentity"
          width={975}
          height={610}
          style={{ width: '100%', height: 'auto' }}
        >
          <ZoomableGroup>
            <Geographies geography={statesAlbers as any}>
              {({ geographies }: { geographies: any[] }) =>
                geographies.map((geo) => {
                  const geoName = geo.properties.name as string
                  const stateData = statesByName.get(geoName)
                  const abbr = stateData?.abbreviation

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getFill(abbr)}
                      stroke={getStroke(abbr)}
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none', opacity: getOpacity(abbr) },
                        hover: {
                          outline: 'none',
                          opacity: 0.8,
                          fill: 'var(--color-primary)',
                          cursor: 'pointer',
                        },
                        pressed: {
                          outline: 'none',
                          opacity: 1,
                          fill: 'var(--color-primary)',
                        },
                      }}
                      onMouseEnter={(e) => {
                        if (stateData) {
                          const svg = (e.target as SVGElement).closest('svg')
                          const rect = svg?.getBoundingClientRect()
                          const clientX = (e as unknown as MouseEvent).clientX
                          const clientY = (e as unknown as MouseEvent).clientY
                          if (rect) {
                            setTooltip({
                              state: stateData,
                              x: clientX - rect.left,
                              y: clientY - rect.top,
                            })
                          }
                        }
                      }}
                      onMouseMove={(e) => {
                        if (tooltip) {
                          const svg = (e.target as SVGElement).closest('svg')
                          const rect = svg?.getBoundingClientRect()
                          const clientX = (e as unknown as MouseEvent).clientX
                          const clientY = (e as unknown as MouseEvent).clientY
                          if (rect) {
                            setTooltip((prev) =>
                              prev
                                ? { ...prev, x: clientX - rect.left, y: clientY - rect.top }
                                : null,
                            )
                          }
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => {
                        if (abbr) navigate(`/estados/${abbr}`)
                      }}
                    />
                  )
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {/* Hover tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-10 bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-sm"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y - 10,
              transform: 'translateY(-100%)',
            }}
          >
            <p className="font-semibold">
              {tooltip.state.name}{' '}
              <span className="text-muted-foreground font-normal">({tooltip.state.abbreviation})</span>
            </p>
            <div className="flex flex-col gap-0.5 mt-1 text-xs text-muted-foreground">
              <span>
                Precio:{' '}
                <span className="text-primary font-medium">
                  {formatPrice(tooltip.state.sale_price)}
                </span>
              </span>
              <span>Fee del estado: {formatPrice(tooltip.state.state_fee)}</span>
              <span>Proceso: {formatDays(tooltip.state.processing_days)} días</span>
            </div>
          </div>
        )}

        {/* Search exact-match tooltip */}
        {exactMatch && !tooltip && (
          <div className="absolute top-4 right-4 z-10 bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-sm">
            <p className="font-semibold">
              {exactMatch.name}{' '}
              <span className="text-muted-foreground font-normal">({exactMatch.abbreviation})</span>
            </p>
            <div className="flex flex-col gap-0.5 mt-1 text-xs text-muted-foreground">
              <span>
                Precio:{' '}
                <span className="text-primary font-medium">
                  {formatPrice(exactMatch.sale_price)}
                </span>
              </span>
              <span>Fee del estado: {formatPrice(exactMatch.state_fee)}</span>
              <span>Proceso: {formatDays(exactMatch.processing_days)} días</span>
            </div>
          </div>
        )}
      </div>

      {hasSearch && filteredStates.length === 0 && (
        <p className="text-center text-muted-foreground py-4">
          No se encontraron estados para "{search}"
        </p>
      )}
    </div>
  )
}
