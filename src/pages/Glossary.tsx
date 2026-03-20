import { useState, useMemo } from 'react'
import { useGlossary } from '@/hooks/useGlossary'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Search } from 'lucide-react'

const CATEGORIES = [
  { value: 'all', label: 'Todos' },
  { value: 'business_structure', label: 'Estructura Empresarial' },
  { value: 'tax', label: 'Impuestos' },
  { value: 'legal', label: 'Legal' },
  { value: 'compliance', label: 'Cumplimiento' },
] as const

export default function Glossary() {
  const { data: terms, isLoading } = useGlossary()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const filtered = useMemo(() => {
    if (!terms) return []
    let result = terms
    if (category !== 'all') {
      result = result.filter((t) => t.category === category)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.term.toLowerCase().includes(q) ||
          t.full_name.toLowerCase().includes(q) ||
          t.translation.toLowerCase().includes(q)
      )
    }
    return result
  }, [terms, search, category])

  if (isLoading) {
    return <p className="text-muted-foreground">Cargando glosario...</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Glosario</h1>

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
            placeholder="Buscar término, nombre o traducción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((term) => (
          <Card key={term.term} className="h-full">
            <CardContent className="p-4 space-y-2">
              <p className="text-lg font-bold">{term.term}</p>
              <p className="text-sm text-muted-foreground">{term.full_name}</p>
              <p className="text-base text-primary font-medium">{term.translation}</p>
              <p className="text-sm text-muted-foreground">{term.definition}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No se encontraron términos
        </p>
      )}
    </div>
  )
}
