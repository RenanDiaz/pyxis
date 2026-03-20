import { useQuery } from '@tanstack/react-query'
import type { GlossaryTerm } from '@/types'
import glossaryData from '@/data/glossary.json'

export function useGlossary() {
  return useQuery<GlossaryTerm[]>({
    queryKey: ['glossary'],
    queryFn: () => glossaryData as GlossaryTerm[],
    staleTime: Infinity,
  })
}
