import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { getUserProfile } from '@/lib/firestore'
import { TeamProvider } from '@/contexts/TeamContext'

export function TeamProviderWrapper({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { data: profile } = useQuery({
    queryKey: ['userProfile', user?.uid],
    queryFn: () => getUserProfile(user!.uid),
    enabled: !!user,
  })

  const teamIds = profile?.team_ids ?? []

  return <TeamProvider userTeamIds={teamIds}>{children}</TeamProvider>
}
