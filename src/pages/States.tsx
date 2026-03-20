import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStates } from '@/hooks/useStates'
import { formatPrice, formatDays } from '@/lib/format'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search } from 'lucide-react'

export default function States() {
  const { data: states, isLoading } = useStates()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!states) return []
    if (!search.trim()) return states
    const q = search.toLowerCase()
    return states.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.abbreviation.toLowerCase().includes(q)
    )
  }, [states, search])

  if (isLoading) {
    return <p className="text-muted-foreground">Cargando estados...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Estados</h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o abreviatura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((state) => (
          <Link key={state.abbreviation} to={`/estados/${state.abbreviation}`}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{state.name}</h3>
                      <Badge variant="secondary">{state.abbreviation}</Badge>
                    </div>
                    <p className="text-2xl font-bold text-primary mt-1">
                      {formatPrice(state.sale_price)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                  <span>Fee: {formatPrice(state.state_fee)}</span>
                  <span>{formatDays(state.processing_days)} días</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No se encontraron estados para "{search}"
        </p>
      )}
    </div>
  )
}
