import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { getUserTeamMembership } from '@/lib/firestore'
import type { TeamRole } from '@/types'

const STORAGE_KEY = 'pyxis-active-team'

interface TeamContextType {
  activeTeamId: string | null
  activeTeamRole: TeamRole | null
  setActiveTeamId: (id: string | null) => void
  isLoadingTeamRole: boolean
}

const TeamContext = createContext<TeamContextType | null>(null)

export function TeamProvider({
  children,
  userTeamIds,
}: {
  children: ReactNode
  userTeamIds: string[]
}) {
  const { user } = useAuth()

  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored || null
  })

  // Validate stored team is still in user's teams
  useEffect(() => {
    if (activeTeamId && userTeamIds.length > 0 && !userTeamIds.includes(activeTeamId)) {
      setActiveTeamIdState(null)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [activeTeamId, userTeamIds])

  const setActiveTeamId = useCallback((id: string | null) => {
    setActiveTeamIdState(id)
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Fetch the user's role within the active team
  const { data: membership, isLoading: isLoadingTeamRole } = useQuery({
    queryKey: ['teamMembership', activeTeamId, user?.uid],
    queryFn: () => getUserTeamMembership(activeTeamId!, user!.uid),
    enabled: !!activeTeamId && !!user,
  })

  const activeTeamRole = membership?.role ?? null

  return (
    <TeamContext.Provider
      value={{ activeTeamId, activeTeamRole, setActiveTeamId, isLoadingTeamRole }}
    >
      {children}
    </TeamContext.Provider>
  )
}

export function useTeamContext() {
  const context = useContext(TeamContext)
  if (!context) {
    throw new Error('useTeamContext must be used within a TeamProvider')
  }
  return context
}
