import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Call, CallOutcome } from '@/types'
import {
  getCalls,
  getUpcomingCalls,
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
  const { roleCtx } = useUserProfile()
  return useQuery<Call[]>({
    queryKey: ['calls', roleCtx?.uid, roleCtx?.role, filters],
    queryFn: () => getCalls(roleCtx!, filters),
    enabled: !!roleCtx,
  })
}

export function useUpcomingCalls(max: number = 5) {
  const { roleCtx } = useUserProfile()
  return useQuery<Call[]>({
    queryKey: ['calls', 'upcoming', roleCtx?.uid, roleCtx?.role, max],
    queryFn: () => getUpcomingCalls(roleCtx!, max),
    enabled: !!roleCtx,
  })
}

export function useCreateCall() {
  const { roleCtx } = useUserProfile()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Call, 'id' | 'created_at' | 'owner_uid' | 'team_id'>) =>
      createCall(roleCtx!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] })
    },
  })
}

export function useUpdateCall() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Call> }) =>
      updateCall(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] })
    },
  })
}
