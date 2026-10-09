import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { describeError } from '@/lib/errors'

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profileError, retryProfile, signOut } = useAuth()
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

  if (profileError) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-lg font-medium">No se pudo cargar tu perfil</p>
        <p className="text-sm text-muted-foreground">
          {describeError(profileError, 'Revisa tu conexión e intenta de nuevo.')}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => signOut()}>
            Cerrar sesión
          </Button>
          <Button onClick={() => retryProfile()}>Reintentar</Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
