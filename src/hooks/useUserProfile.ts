import { useAuth } from '@/contexts/AuthContext'
import { useWorkspaceContext } from '@/contexts/WorkspaceContext'
import type { WorkspaceCtx } from '@/lib/firestore'
import type { WorkspaceRole } from '@/types'

export function useUserProfile() {
  const { user } = useAuth()
  const { workspace, member, role, workspaceId, needsOnboarding, isLoading } = useWorkspaceContext()

  const wsCtx: WorkspaceCtx | null =
    user && workspaceId && member
      ? {
          uid: user.uid,
          workspaceId,
          role: member.role,
          subteamId: member.subteam_id,
        }
      : null

  return {
    profile: member,
    role: (role ?? 'agent') as WorkspaceRole,
    workspaceId,
    workspace,
    needsOnboarding,
    isLoading,
    wsCtx,
  }
}
