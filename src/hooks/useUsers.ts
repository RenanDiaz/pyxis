import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UserProfile } from '@/types'
import { getAllUsers, getTeamMembers, updateUserProfile } from '@/lib/firestore'

export function useAllUsers() {
  return useQuery<UserProfile[]>({
    queryKey: ['users'],
    queryFn: getAllUsers,
  })
}

export function useTeamMembers(teamId: string | null | undefined) {
  return useQuery<UserProfile[]>({
    queryKey: ['teamMembers', teamId],
    queryFn: () => getTeamMembers(teamId!),
    enabled: !!teamId,
  })
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ uid, data }: { uid: string; data: Partial<Pick<UserProfile, 'role' | 'team_ids'>> }) =>
      updateUserProfile(uid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] })
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
    },
  })
}
