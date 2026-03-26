import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Team } from '@/types'
import { getTeams, createTeam, updateTeam } from '@/lib/firestore'

export function useTeams() {
  return useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: getTeams,
  })
}

export function useCreateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; supervisor_uid: string }) => createTeam(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

export function useUpdateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Team, 'name' | 'supervisor_uid'>> }) =>
      updateTeam(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}
