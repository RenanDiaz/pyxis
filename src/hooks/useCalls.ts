import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Call, CallOutcome } from '@/types'
import {
  getCalls,
  getUpcomingCalls,
  createCall,
  updateCall,
} from '@/lib/firestore'
import { useAuth } from '@/contexts/AuthContext'

interface CallFilters {
  clientId?: string
  outcome?: CallOutcome
  fromDate?: Date
  toDate?: Date
}

export function useCalls(filters?: CallFilters) {
  const { user } = useAuth()
  return useQuery<Call[]>({
    queryKey: ['calls', user?.uid, filters],
    queryFn: () => getCalls(user!.uid, filters),
    enabled: !!user,
  })
}

export function useUpcomingCalls(max: number = 5) {
  const { user } = useAuth()
  return useQuery<Call[]>({
    queryKey: ['calls', 'upcoming', user?.uid, max],
    queryFn: () => getUpcomingCalls(user!.uid, max),
    enabled: !!user,
  })
}

export function useCreateCall() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Call, 'id' | 'created_at'>) =>
      createCall(user!.uid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] })
    },
  })
}

export function useUpdateCall() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Call> }) =>
      updateCall(user!.uid, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] })
    },
  })
}
