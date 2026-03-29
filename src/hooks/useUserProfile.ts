import { useQuery } from '@tanstack/react-query'
import type { UserProfile, UserRole } from '@/types'
import { getUserProfile, type RoleContext } from '@/lib/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { useTeamContext } from '@/contexts/TeamContext'

export function useUserProfile() {
  const { user } = useAuth()
  const { activeTeamId, activeTeamRole } = useTeamContext()

  const query = useQuery<UserProfile | null>({
    queryKey: ['userProfile', user?.uid],
    queryFn: () => getUserProfile(user!.uid),
    enabled: !!user,
  })

  const profile = query.data ?? null

  const roleCtx: RoleContext | null = profile
    ? {
        uid: profile.uid,
        globalRole: profile.role,
        activeTeamId,
        activeTeamRole,
      }
    : user
      ? {
          uid: user.uid,
          globalRole: 'agent' as UserRole,
          activeTeamId,
          activeTeamRole,
        }
      : null

  return {
    ...query,
    profile,
    role: profile?.role ?? ('agent' as UserRole),
    team_ids: profile?.team_ids ?? [],
    roleCtx,
  }
}
