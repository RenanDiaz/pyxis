import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { clearUserWorkspace, getUserProfile, getWorkspace, getWorkspaceMember } from '@/lib/firestore'
import type { Workspace, WorkspaceMember, WorkspaceRole } from '@/types'

interface WorkspaceContextType {
  workspace: Workspace | null
  member: WorkspaceMember | null
  role: WorkspaceRole | null
  workspaceId: string | null
  needsOnboarding: boolean
  isLoading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  // Step 1: get user profile to read workspace_id
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['userProfile', user?.uid],
    queryFn: () => getUserProfile(user!.uid),
    enabled: !!user,
  })

  const workspaceId = profile?.workspace_id ?? null

  // Step 2: load member doc (se puede leer el propio aunque ya no exista)
  const { data: member, isLoading: memberLoading } = useQuery({
    queryKey: ['workspaceMember', workspaceId, user?.uid],
    queryFn: () => getWorkspaceMember(workspaceId!, user!.uid),
    enabled: !!workspaceId && !!user,
  })

  // Apunta a un workspace del que ya no es miembro (lo quitaron o se borró):
  // sin esto la app quedaba en blanco (spec 06).
  const invalidWorkspace = !!workspaceId && !memberLoading && member === null

  // Step 3: load workspace doc (solo siendo miembro: si no, las reglas lo niegan)
  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => getWorkspace(workspaceId!),
    enabled: !!workspaceId && !!member,
  })

  const queryClient = useQueryClient()
  const clearing = useRef(false)
  useEffect(() => {
    if (!invalidWorkspace || !user || clearing.current) return
    clearing.current = true
    clearUserWorkspace(user.uid)
      .then(() => {
        toast.info('Ya no perteneces a ese workspace. Crea uno nuevo o únete con una invitación.')
        return queryClient.invalidateQueries({ queryKey: ['userProfile', user.uid] })
      })
      .catch(() => {
        // Sin conexión: se reintenta en la próxima carga.
      })
      .finally(() => {
        clearing.current = false
      })
  }, [invalidWorkspace, user, queryClient])

  const isLoading =
    profileLoading || (!!workspaceId && !invalidWorkspace && (wsLoading || memberLoading))
  const needsOnboarding = !profileLoading && !!profile && (!workspaceId || invalidWorkspace)

  return (
    <WorkspaceContext.Provider
      value={{
        workspace: workspace ?? null,
        member: member ?? null,
        role: member?.role ?? null,
        workspaceId,
        needsOnboarding,
        isLoading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

// El hook vive junto a su Provider a propósito; solo afecta al fast refresh en dev.
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceProvider')
  }
  return context
}
