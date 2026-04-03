import { Navigate } from 'react-router-dom'
import { useUserProfile } from '@/hooks/useUserProfile'
import type { WorkspaceRole } from '@/types'

interface RoleRouteProps {
  allowedRoles: WorkspaceRole[]
  children: React.ReactNode
}

export default function RoleRoute({ allowedRoles, children }: RoleRouteProps) {
  const { role, isLoading } = useUserProfile()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
