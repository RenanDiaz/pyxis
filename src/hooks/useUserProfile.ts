import { useQuery } from '@tanstack/react-query'
import type { UserProfile, UserRole } from '@/types'
import { getUserProfile } from '@/lib/firestore'
import { useAuth } from '@/contexts/AuthContext'

export function useUserProfile() {
  const { user } = useAuth()
  const query = useQuery<UserProfile | null>({
    queryKey: ['userProfile', user?.uid],
    queryFn: () => getUserProfile(user!.uid),
    enabled: !!user,
  })

  const profile = query.data ?? null
  const roleCtx = profile
    ? { uid: profile.uid, role: profile.role, team_id: profile.team_id }
    : user
      ? { uid: user.uid, role: 'agent' as UserRole, team_id: null }
      : null

  return {
    ...query,
    profile,
    role: profile?.role ?? ('agent' as UserRole),
    team_id: profile?.team_id ?? null,
    roleCtx,
  }
}
