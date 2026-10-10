import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Call, CallOutcome } from '@/types'
import {
  getCalls,
  getUpcomingCalls,
  getOverdueCalls,
  countOverdueBefore,
  createCall,
  updateCall,
} from '@/lib/firestore'
import { bellWindowStart } from '@/lib/bellCalls'
import { useUserProfile } from '@/hooks/useUserProfile'

interface CallFilters {
  clientId?: string
  outcome?: CallOutcome
  fromDate?: Date
  toDate?: Date
}

export function useCalls(filters?: CallFilters) {
  const { wsCtx } = useUserProfile()
  return useQuery<Call[]>({
    queryKey: ['calls', wsCtx?.workspaceId, wsCtx?.role, wsCtx?.uid, filters],
    queryFn: () => getCalls(wsCtx!, filters),
    enabled: !!wsCtx,
  })
}

// La campana y el inicio se refrescan solos (spec 10): una llamada que vence
// con la app abierta aparece en ≤ 1 min, y al volver a la pestaña al instante.
const CALL_ALERTS_REFRESH = {
  refetchInterval: 60_000,
  refetchOnWindowFocus: 'always',
} as const

export function useUpcomingCalls(max: number = 5) {
  const { wsCtx } = useUserProfile()
  return useQuery<Call[]>({
    queryKey: ['calls', 'upcoming', wsCtx?.workspaceId, wsCtx?.role, wsCtx?.uid, max],
    queryFn: () => getUpcomingCalls(wsCtx!, max),
    enabled: !!wsCtx,
    ...CALL_ALERTS_REFRESH,
  })
}

/** Vencidas de la ventana de la campana (últimos 14 días, spec 20). */
export function useOverdueCalls(max: number = 10) {
  const { wsCtx } = useUserProfile()
  return useQuery<Call[]>({
    queryKey: ['calls', 'overdue', wsCtx?.workspaceId, wsCtx?.role, wsCtx?.uid, max],
    queryFn: () => getOverdueCalls(wsCtx!, max, bellWindowStart()),
    enabled: !!wsCtx,
    ...CALL_ALERTS_REFRESH,
  })
}

/** Vencidas más antiguas que la ventana: la campana solo las resume. */
export function useOlderOverdueCount() {
  const { wsCtx } = useUserProfile()
  return useQuery<number>({
    queryKey: ['calls', 'overdue-older', wsCtx?.workspaceId, wsCtx?.role, wsCtx?.uid],
    queryFn: () => countOverdueBefore(wsCtx!, bellWindowStart()),
    enabled: !!wsCtx,
    ...CALL_ALERTS_REFRESH,
  })
}

export function useCreateCall() {
  const { wsCtx } = useUserProfile()
  const queryClient = useQueryClient()
  return useMutation({
    meta: { errorMessage: 'No se pudo guardar la llamada' },
    mutationFn: ({
      data,
      assignTo,
    }: {
      data: Omit<Call, 'id' | 'created_at' | 'owner_uid' | 'subteam_id'>
      assignTo?: { owner_uid: string; subteam_id: string | null }
    }) => createCall(wsCtx!, data, assignTo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] })
    },
  })
}

export function useUpdateCall() {
  const { workspaceId } = useUserProfile()
  const queryClient = useQueryClient()
  return useMutation({
    meta: { errorMessage: 'No se pudo actualizar la llamada' },
    mutationFn: ({ id, data }: { id: string; data: Partial<Call> }) =>
      updateCall(workspaceId!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] })
    },
  })
}
