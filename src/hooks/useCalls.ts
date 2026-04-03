import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Call, CallOutcome } from '@/types'
import {
  getCalls,
  getUpcomingCalls,
  getOverdueCalls,
  createCall,
  updateCall,
} from '@/lib/firestore'
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

export function useUpcomingCalls(max: number = 5) {
  const { wsCtx } = useUserProfile()
  return useQuery<Call[]>({
    queryKey: ['calls', 'upcoming', wsCtx?.workspaceId, wsCtx?.role, wsCtx?.uid, max],
    queryFn: () => getUpcomingCalls(wsCtx!, max),
    enabled: !!wsCtx,
  })
}

export function useOverdueCalls(max: number = 10) {
  const { wsCtx } = useUserProfile()
  return useQuery<Call[]>({
    queryKey: ['calls', 'overdue', wsCtx?.workspaceId, wsCtx?.role, wsCtx?.uid, max],
    queryFn: () => getOverdueCalls(wsCtx!, max),
    enabled: !!wsCtx,
  })
}

export function useCreateCall() {
  const { wsCtx } = useUserProfile()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Call, 'id' | 'created_at' | 'owner_uid' | 'subteam_id'>) =>
      createCall(wsCtx!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] })
    },
  })
}

export function useUpdateCall() {
  const { workspaceId } = useUserProfile()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Call> }) =>
      updateCall(workspaceId!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] })
    },
  })
}
