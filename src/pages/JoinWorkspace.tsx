import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useInvitationByToken, useAcceptInvitation } from '@/hooks/useWorkspaceInvitations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  supervisor: 'Supervisor',
  agent: 'Agente',
}

export default function JoinWorkspace() {
  const { user, signOut } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const acceptInvitation = useAcceptInvitation()

  const token = searchParams.get('token')
  const workspaceId = searchParams.get('workspace')

  const { data: invitation, isLoading: invLoading } = useInvitationByToken(workspaceId, token)
  const [joining, setJoining] = useState(false)

  const handleJoin = async () => {
    if (!user || !invitation || !workspaceId) return
    setJoining(true)
    try {
      await acceptInvitation.mutateAsync({
        workspaceId,
        invitationId: invitation.id,
        user: {
          uid: user.uid,
          display_name: user.displayName || user.email || '',
          email: user.email || '',
        },
      })
      toast.success('Te has unido al workspace')
      navigate('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al unirse')
    } finally {
      setJoining(false)
    }
  }

  if (!token || !workspaceId) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
            <p className="font-medium">Enlace de invitación inválido</p>
            <p className="text-sm text-muted-foreground">
              El enlace no contiene los parámetros necesarios.
            </p>
            <Button onClick={() => navigate('/')} variant="outline">
              Ir al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (invLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Validando invitación...</p>
        </div>
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
            <p className="font-medium">Invitación no encontrada</p>
            <p className="text-sm text-muted-foreground">
              Esta invitación no existe, ya fue usada o ha expirado.
            </p>
            <Button onClick={() => navigate('/')} variant="outline">
              Ir al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const expired = invitation.expires_at.toMillis() < Date.now()
  if (invitation.status !== 'pending' || expired) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
            <p className="font-medium">
              {invitation.status === 'accepted' ? 'Invitación ya aceptada' : 'Invitación expirada'}
            </p>
            {invitation.status !== 'accepted' && (
              <p className="text-sm text-muted-foreground">
                Pide al administrador del workspace que te envíe un enlace nuevo.
              </p>
            )}
            <Button onClick={() => navigate('/')} variant="outline">
              Ir al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // La invitación es nominal: las reglas solo dejan aceptarla con la cuenta del
  // correo invitado.
  const userEmail = user?.email?.toLowerCase() ?? ''
  if (invitation.email && invitation.email.toLowerCase() !== userEmail) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
            <p className="font-medium">Esta invitación es para otra cuenta</p>
            <p className="text-sm text-muted-foreground">
              La invitación se envió a <span className="font-medium">{invitation.email}</span>,
              pero iniciaste sesión como <span className="font-medium">{user?.email || 'otra cuenta'}</span>.
              Cierra sesión y entra con el correo invitado.
            </p>
            {/* Al cerrar sesión, PrivateRoute manda al login y vuelve a este link. */}
            <Button onClick={() => signOut()}>Cerrar sesión y cambiar de cuenta</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Unirse a workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
          <div>
            <p className="font-medium text-lg">
              {invitation.workspace_name || 'Workspace'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Has sido invitado como <span className="font-medium">{ROLE_LABELS[invitation.role] ?? invitation.role}</span>
            </p>
          </div>
          <Button
            onClick={handleJoin}
            disabled={joining}
            className="w-full"
          >
            {joining ? 'Uniéndose...' : 'Unirse al workspace'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
