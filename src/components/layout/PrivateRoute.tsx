import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (!user) {
    // Recordar a dónde iba (p. ej. un link de invitación) para volver tras el login.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return <>{children}</>
}
