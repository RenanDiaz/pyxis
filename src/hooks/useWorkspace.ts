import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { WorkspaceMember, WorkspaceRole, Subteam } from '@/types'
import {
  getWorkspaceMembers,
  updateMemberRole,
  updateMemberSubteam,
  getSubteams,
  createSubteam,
  updateSubteam,
  deleteSubteam,
  updateWorkspace,
} from '@/lib/firestore'
import { db } from '@/lib/firebase'
import {
  deleteWorkspaceCascade,
  removeMemberWithReassign,
  transferOwnership,
  type AdminProgress,
  type ReassignTarget,
} from '@/lib/workspaceAdmin'
import { deleteFileFromStorage } from '@/lib/adminStorage'

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
  subteamId: string | null,
  uid?: string
) {
  const { data: members, ...rest } = useWorkspaceMembers(
    role === 'owner' || role === 'supervisor' ? workspaceId : null
  )

  // Mismo criterio que `canHold` en firestore.rules (spec 13).
  const assignable = useMemo(() => {
    if (!members) return []
    // Owner: cualquier miembro, incluido él mismo.
    if (role === 'owner') return members
    if (role === 'supervisor') {
      // Sin subequipo solo puede asignarse a sí mismo; antes veía a todos los
      // miembros sin subequipo y las reglas rechazaban el guardado.
      if (!subteamId) return members.filter((m) => m.uid === uid)
      return members.filter((m) => m.subteam_id === subteamId)
    }
    return []
  }, [members, role, subteamId, uid])

  return { data: assignable, ...rest }
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { errorMessage: 'No se pudo cambiar el rol' },
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
    meta: { errorMessage: 'No se pudo cambiar el subequipo' },
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
    meta: { errorMessage: 'No se pudo quitar al miembro' },
    mutationFn: ({ workspaceId, uid, target }: { workspaceId: string; uid: string; target: ReassignTarget }) =>
      removeMemberWithReassign(db!, workspaceId, uid, target),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceMembers'] })
      queryClient.invalidateQueries({ queryKey: ['workspaceMember'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['calls'] })
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
    meta: { errorMessage: 'No se pudo crear el subequipo' },
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
    meta: { errorMessage: 'No se pudo renombrar el subequipo' },
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
    meta: { errorMessage: 'No se pudo eliminar el subequipo' },
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
    meta: { errorMessage: 'No se pudo guardar el workspace' },
    mutationFn: ({ id, data }: {
      id: string
      data: {
        name?: string
        owner_uid?: string
        receipt_company_name?: string
        receipt_logo_url?: string
        receipt_logo_path?: string
        payment_instructions?: string
      }
    }) => updateWorkspace(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
    },
  })
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { errorMessage: 'No se pudo eliminar el workspace. Puedes reintentar: continúa donde quedó.' },
    mutationFn: (args: {
      workspaceId: string
      ownerUid: string
      logoPath?: string | null
      onProgress?: (p: AdminProgress) => void
    }) =>
      deleteWorkspaceCascade(db!, args.workspaceId, args.ownerUid, {
        deleteFile: deleteFileFromStorage,
        logoPath: args.logoPath,
        onProgress: args.onProgress,
      }),
    // Sin workspace, toda la caché es de datos que ya no existen.
    onSuccess: () => queryClient.clear(),
  })
}

export function useTransferOwnership() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { errorMessage: 'No se pudo transferir la propiedad' },
    mutationFn: ({ workspaceId, fromUid, toUid }: { workspaceId: string; fromUid: string; toUid: string }) =>
      transferOwnership(db!, workspaceId, fromUid, toUid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] })
      queryClient.invalidateQueries({ queryKey: ['workspaceMember'] })
      queryClient.invalidateQueries({ queryKey: ['workspaceMembers'] })
    },
  })
}
