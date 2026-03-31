import { useState } from 'react'
import {
  useTeamMemberships,
  useRemoveTeamMember,
  useUpdateTeamMemberRole,
} from '@/hooks/useTeams'
import { useTeamInvitations, useCreateInvitation, useCancelInvitation } from '@/hooks/useInvitations'
import { useAuth } from '@/contexts/AuthContext'
import { useTeamContext } from '@/contexts/TeamContext'
import { useUserTeams } from '@/hooks/useTeams'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { UserMinus, Shield, User, UsersRound, Mail, Clock, X } from 'lucide-react'
import { toast } from 'sonner'
import type { TeamRole } from '@/types'

export default function TeamMembers() {
  const { activeTeamId } = useTeamContext()
  const { team_ids } = useUserProfile()
  const { data: teams } = useUserTeams(team_ids)
  const activeTeam = teams?.find((t) => t.id === activeTeamId)

  if (!activeTeamId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <UsersRound className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">No hay equipo seleccionado</p>
        <p className="text-sm mt-1">Selecciona un equipo desde el menú superior</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Miembros del equipo</h1>
          {activeTeam && (
            <p className="text-sm text-muted-foreground mt-1">{activeTeam.name}</p>
          )}
        </div>
        <InviteMemberDialog teamId={activeTeamId} teamName={activeTeam?.name ?? ''} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Miembros</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamMembersList teamId={activeTeamId} />
        </CardContent>
      </Card>

      <PendingInvitationsList teamId={activeTeamId} />
    </div>
  )
}

function TeamMembersList({ teamId }: { teamId: string }) {
  const { data: memberships, isLoading } = useTeamMemberships(teamId)
  const removeMember = useRemoveTeamMember()
  const updateRole = useUpdateTeamMemberRole()

  const handleRemove = async (uid: string) => {
    try {
      await removeMember.mutateAsync({ teamId, uid })
      toast.success('Miembro removido del equipo')
    } catch {
      toast.error('Error al remover miembro')
    }
  }

  const handleRoleToggle = async (uid: string, currentRole: TeamRole) => {
    const newRole: TeamRole = currentRole === 'admin' ? 'member' : 'admin'
    try {
      await updateRole.mutateAsync({ teamId, uid, role: newRole })
      toast.success(`Rol actualizado a ${newRole === 'admin' ? 'Admin' : 'Miembro'}`)
    } catch {
      toast.error('Error al actualizar rol')
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando miembros...</p>
  if (!memberships || memberships.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-muted-foreground">
        <UsersRound className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">No hay miembros en este equipo</p>
        <p className="text-xs mt-1">Agrega miembros usando el botón de arriba</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {memberships.map((m) => (
        <div
          key={m.uid}
          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
              {(m.display_name || m.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{m.display_name}</p>
              <p className="text-xs text-muted-foreground">{m.email}</p>
            </div>
            <Badge
              variant="secondary"
              className={
                m.role === 'admin'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
              }
            >
              {m.role === 'admin' ? 'Admin' : 'Miembro'}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => handleRoleToggle(m.uid, m.role)}
              title={m.role === 'admin' ? 'Cambiar a miembro' : 'Cambiar a admin'}
            >
              {m.role === 'admin' ? (
                <User className="h-4 w-4" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => handleRemove(m.uid)}
              title="Remover del equipo"
            >
              <UserMinus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function InviteMemberDialog({ teamId, teamName }: { teamId: string; teamName: string }) {
  const { user } = useAuth()
  const createInvitation = useCreateInvitation()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !user) return
    try {
      await createInvitation.mutateAsync({
        team_id: teamId,
        team_name: teamName,
        email: trimmed,
        role: 'member',
        invited_by_uid: user.uid,
        invited_by_name: user.displayName || user.email || '',
      })
      toast.success(`Invitación enviada a ${trimmed}`)
      setOpen(false)
      setEmail('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar invitación')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Mail className="mr-2 h-4 w-4" />
          Invitar miembro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar miembro al equipo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Correo electrónico</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="mt-1.5"
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Se enviará una invitación al correo indicado. Si el usuario aún no tiene cuenta,
            podrá aceptar la invitación cuando se registre.
          </p>
          <Button
            onClick={handleInvite}
            disabled={!email.trim() || createInvitation.isPending}
            className="w-full"
          >
            {createInvitation.isPending ? 'Enviando...' : 'Enviar invitación'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PendingInvitationsList({ teamId }: { teamId: string }) {
  const { data: invitations } = useTeamInvitations(teamId)
  const cancelInvitation = useCancelInvitation()

  const handleCancel = async (id: string) => {
    try {
      await cancelInvitation.mutateAsync(id)
      toast.success('Invitación cancelada')
    } catch {
      toast.error('Error al cancelar invitación')
    }
  }

  if (!invitations || invitations.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Invitaciones pendientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-sm font-medium">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Invitado por {inv.invited_by_name}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                >
                  Pendiente
                </Badge>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleCancel(inv.id)}
                title="Cancelar invitación"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
