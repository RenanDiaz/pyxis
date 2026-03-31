import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { TeamInvitation } from '@/types'
import {
  createTeamInvitation,
  getTeamInvitations,
  getPendingInvitationsForUser,
  acceptTeamInvitation,
  declineTeamInvitation,
  cancelTeamInvitation,
} from '@/lib/firestore'
import type { TeamRole } from '@/types'

export function useTeamInvitations(teamId: string | null | undefined) {
  return useQuery<TeamInvitation[]>({
    queryKey: ['teamInvitations', teamId],
    queryFn: () => getTeamInvitations(teamId!),
    enabled: !!teamId,
  })
}

export function usePendingInvitations(email: string | null | undefined) {
  return useQuery<TeamInvitation[]>({
    queryKey: ['pendingInvitations', email],
    queryFn: () => getPendingInvitationsForUser(email!),
    enabled: !!email,
  })
}

export function useCreateInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      team_id: string
      team_name: string
      email: string
      role: TeamRole
      invited_by_uid: string
      invited_by_name: string
    }) => createTeamInvitation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamInvitations'] })
    },
  })
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      invitationId,
      user,
    }: {
      invitationId: string
      user: { uid: string; display_name: string; email: string }
    }) => acceptTeamInvitation(invitationId, user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingInvitations'] })
      queryClient.invalidateQueries({ queryKey: ['teamInvitations'] })
      queryClient.invalidateQueries({ queryKey: ['teamMemberships'] })
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
      queryClient.invalidateQueries({ queryKey: ['userTeams'] })
    },
  })
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: string) => declineTeamInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingInvitations'] })
      queryClient.invalidateQueries({ queryKey: ['teamInvitations'] })
    },
  })
}

export function useCancelInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: string) => cancelTeamInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamInvitations'] })
    },
  })
}
