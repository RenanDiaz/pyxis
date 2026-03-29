import { Navigate } from 'react-router-dom'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useTeamContext } from '@/contexts/TeamContext'
import type { UserRole, TeamRole } from '@/types'

interface RoleRouteProps {
  allowedRoles?: UserRole[]
  requiredTeamRole?: TeamRole
  children: React.ReactNode
}

export default function RoleRoute({ allowedRoles, requiredTeamRole, children }: RoleRouteProps) {
  const { role, isLoading } = useUserProfile()
  const { activeTeamId, activeTeamRole, isLoadingTeamRole } = useTeamContext()

  if (isLoading || isLoadingTeamRole) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  // Check global role if specified
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  // Check team role if specified
  if (requiredTeamRole) {
    if (!activeTeamId || activeTeamRole !== requiredTeamRole) {
      return <Navigate to="/" replace />
    }
  }

  return <>{children}</>
}
