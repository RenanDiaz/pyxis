import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { WorkspaceMember, WorkspaceRole, Subteam } from '@/types'
import {
  getWorkspaceMembers,
  updateMemberRole,
  updateMemberSubteam,
  removeMember,
  getSubteams,
  createSubteam,
  updateSubteam,
  deleteSubteam,
  updateWorkspace,
  deleteWorkspace,
} from '@/lib/firestore'

export function useWorkspaceMembers(workspaceId: string | null | undefined) {
  return useQuery<WorkspaceMember[]>({
    queryKey: ['workspaceMembers', workspaceId],
    queryFn: () => getWorkspaceMembers(workspaceId!),
    enabled: !!workspaceId,
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workspaceId, uid, role }: { workspaceId: string; uid: string; role: WorkspaceRole }) =>
      updateMemberRole(workspaceId, uid, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceMembers'] })
      queryClient.invalidateQueries({ queryKey: ['workspaceMember'] })
    },
  })
}

export function useUpdateMemberSubteam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workspaceId, uid, subteamId }: { workspaceId: string; uid: string; subteamId: string | null }) =>
      updateMemberSubteam(workspaceId, uid, subteamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceMembers'] })
      queryClient.invalidateQueries({ queryKey: ['workspaceMember'] })
    },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workspaceId, uid }: { workspaceId: string; uid: string }) =>
      removeMember(workspaceId, uid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceMembers'] })
      queryClient.invalidateQueries({ queryKey: ['workspaceMember'] })
    },
  })
}

export function useSubteams(workspaceId: string | null | undefined) {
  return useQuery<Subteam[]>({
    queryKey: ['subteams', workspaceId],
    queryFn: () => getSubteams(workspaceId!),
    enabled: !!workspaceId,
  })
}

export function useCreateSubteam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workspaceId, name, createdBy }: { workspaceId: string; name: string; createdBy: string }) =>
      createSubteam(workspaceId, { name, created_by: createdBy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subteams'] })
    },
  })
}

export function useUpdateSubteam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workspaceId, subteamId, name }: { workspaceId: string; subteamId: string; name: string }) =>
      updateSubteam(workspaceId, subteamId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subteams'] })
    },
  })
}

export function useDeleteSubteam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workspaceId, subteamId }: { workspaceId: string; subteamId: string }) =>
      deleteSubteam(workspaceId, subteamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subteams'] })
    },
  })
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; owner_uid?: string } }) =>
      updateWorkspace(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
    },
  })
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteWorkspace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
    },
  })
}
