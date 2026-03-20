import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Call, CallOutcome } from '@/types'
import {
  getCalls,
  getUpcomingCalls,
  createCall,
  updateCall,
} from '@/lib/firestore'

interface CallFilters {
  clientId?: string
  outcome?: CallOutcome
  fromDate?: Date
  toDate?: Date
}

export function useCalls(filters?: CallFilters) {
  return useQuery<Call[]>({
    queryKey: ['calls', filters],
    queryFn: () => getCalls(filters),
  })
}

export function useUpcomingCalls(max: number = 5) {
  return useQuery<Call[]>({
    queryKey: ['calls', 'upcoming', max],
    queryFn: () => getUpcomingCalls(max),
  })
}

export function useCreateCall() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCall,
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
