import { useState, useMemo } from 'react'
import { useTrades } from '@/hooks/useTrades'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Search } from 'lucide-react'

const CATEGORIES = [
  { value: 'all', label: 'Todos' },
  { value: 'construction', label: 'Construcción' },
  { value: 'home_services', label: 'Servicios para Casas' },
  { value: 'exterior', label: 'Exterior' },
  { value: 'technical', label: 'Técnicos' },
] as const

export default function Trades() {
  const { data: trades, isLoading } = useTrades()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const filtered = useMemo(() => {
    if (!trades) return []
    let result = trades
    if (category !== 'all') {
      result = result.filter((t) => t.category === category)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.en.toLowerCase().includes(q) ||
          t.es.toLowerCase().includes(q) ||
          t.description_es.toLowerCase().includes(q)
      )
    }
    return result
  }, [trades, search, category])

  if (isLoading) {
    return <p className="text-muted-foreground">Cargando oficios...</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Oficios</h1>

      <div className="flex flex-col gap-4">
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList className="w-full sm:w-auto flex-wrap h-auto">
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.value} value={cat.value} className="text-xs sm:text-sm">
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar oficio en inglés o español..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((trade) => (
          <Card key={trade.id} className="h-full">
            <CardContent className="p-4 space-y-2">
              <p className="text-lg font-bold">{trade.en}</p>
              <p className="text-base text-primary font-medium">{trade.es}</p>
              <p className="text-sm text-muted-foreground">{trade.description_es}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No se encontraron oficios
        </p>
      )}
    </div>
  )
}
