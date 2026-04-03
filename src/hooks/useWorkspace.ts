import { useMemo } from 'react'
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

/**
 * Returns the list of members that the current user can assign clients to.
 * - owner: all agents and supervisors in the workspace (+ self)
 * - supervisor: agents in their subteam (+ self)
 * - agent: empty (no assignment UI shown)
 */
export function useAssignableMembers(
  workspaceId: string | null | undefined,
  role: WorkspaceRole,
  subteamId: string | null
) {
  const { data: members, ...rest } = useWorkspaceMembers(
    role === 'owner' || role === 'supervisor' ? workspaceId : null
  )

  const assignable = useMemo(() => {
    if (!members) return []
    if (role === 'owner') {
      // Owner can assign to any agent or supervisor (including themselves)
      return members.filter((m) => m.role !== 'owner' || true) // all members
    }
    if (role === 'supervisor') {
      // Supervisor can assign to agents in their subteam + themselves
      return members.filter(
        (m) => m.subteam_id === subteamId
      )
    }
    return []
  }, [members, role, subteamId])

  return { data: assignable, ...rest }
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
