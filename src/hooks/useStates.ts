import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { StateInfo } from '@/types'
import statesData from '@/data/states.json'
import { isFirebaseConfigured } from '@/lib/firebase'
import { getStates, updateState } from '@/lib/firestore'

const localStates = statesData as StateInfo[]

/**
 * Carga los estados desde Firestore y usa el JSON local como fallback:
 * si Firestore no está configurado, no responde o la colección está
 * incompleta, cada estado faltante se completa con la versión local.
 */
async function loadStates(): Promise<StateInfo[]> {
  if (!isFirebaseConfigured) return localStates
  try {
    const remote = await getStates()
    if (remote.length === 0) return localStates
    const byAbbr = new Map(localStates.map((s) => [s.abbreviation, s]))
    for (const state of remote) {
      byAbbr.set(state.abbreviation, state)
    }
    return [...byAbbr.values()]
  } catch {
    return localStates
  }
}

export function useStates() {
  return useQuery<StateInfo[]>({
    queryKey: ['states'],
    queryFn: loadStates,
    staleTime: 5 * 60 * 1000,
  })
}

export function useStateByAbbreviation(abbreviation: string | undefined) {
  const { data: states, ...rest } = useStates()
  const data = abbreviation
    ? states?.find((s) => s.abbreviation.toUpperCase() === abbreviation.toUpperCase())
    : undefined
  return { ...rest, data }
}

export function useUpdateState() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      abbreviation,
      data,
    }: {
      abbreviation: string
      data: Partial<StateInfo>
    }) => updateState(abbreviation, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['states'] })
    },
  })
}
