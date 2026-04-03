import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { getUserProfile, getWorkspace, getWorkspaceMember } from '@/lib/firestore'
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

  // Step 2: load workspace doc
  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => getWorkspace(workspaceId!),
    enabled: !!workspaceId,
  })

  // Step 3: load member doc
  const { data: member, isLoading: memberLoading } = useQuery({
    queryKey: ['workspaceMember', workspaceId, user?.uid],
    queryFn: () => getWorkspaceMember(workspaceId!, user!.uid),
    enabled: !!workspaceId && !!user,
  })

  const isLoading = profileLoading || (!!workspaceId && (wsLoading || memberLoading))
  const needsOnboarding = !profileLoading && !!profile && !workspaceId

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

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceProvider')
  }
  return context
}
