import { useQuery } from '@tanstack/react-query'
import type { StateInfo } from '@/types'
import statesData from '@/data/states.json'

export function useStates() {
  return useQuery<StateInfo[]>({
    queryKey: ['states'],
    queryFn: () => statesData as StateInfo[],
    staleTime: Infinity,
  })
}

export function useStateByAbbreviation(abbreviation: string | undefined) {
  return useQuery<StateInfo | undefined>({
    queryKey: ['states', abbreviation],
    queryFn: () => {
      const states = statesData as StateInfo[]
      return states.find(
        (s) => s.abbreviation.toUpperCase() === abbreviation?.toUpperCase()
      )
    },
    enabled: !!abbreviation,
    staleTime: Infinity,
  })
}
