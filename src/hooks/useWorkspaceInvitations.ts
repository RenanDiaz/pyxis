import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { WorkspaceInvitation } from '@/types'
import {
  createInvitation,
  getInvitations,
  getInvitationByToken,
  acceptInvitation,
  cancelInvitation,
} from '@/lib/firestore'

export function useWorkspaceInvitations(workspaceId: string | null | undefined) {
  return useQuery<WorkspaceInvitation[]>({
    queryKey: ['workspaceInvitations', workspaceId],
    queryFn: () => getInvitations(workspaceId!),
    enabled: !!workspaceId,
  })
}

export function useInvitationByToken(workspaceId: string | null, token: string | null) {
  return useQuery<WorkspaceInvitation | null>({
    queryKey: ['invitation', workspaceId, token],
    queryFn: () => getInvitationByToken(workspaceId!, token!),
    enabled: !!workspaceId && !!token,
  })
}

export function useCreateInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      workspaceId,
      email,
      role,
      subteamId,
      createdByUid,
    }: {
      workspaceId: string
      email: string
      role: 'supervisor' | 'agent'
      subteamId: string | null
      createdByUid: string
    }) =>
      createInvitation(workspaceId, {
        email,
        role,
        subteam_id: subteamId,
        created_by_uid: createdByUid,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceInvitations'] })
    },
  })
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      workspaceId,
      invitationId,
      user,
    }: {
      workspaceId: string
      invitationId: string
      user: { uid: string; display_name: string; email: string }
    }) => acceptInvitation(workspaceId, invitationId, user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
      queryClient.invalidateQueries({ queryKey: ['workspaceMember'] })
      queryClient.invalidateQueries({ queryKey: ['workspaceInvitations'] })
    },
  })
}

export function useCancelInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workspaceId, invitationId }: { workspaceId: string; invitationId: string }) =>
      cancelInvitation(workspaceId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceInvitations'] })
    },
  })
}
