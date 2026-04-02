import { useState } from 'react'
import {
  useTeams,
  useCreateTeam,
  useUpdateTeam,
  useTeamMemberships,
  useRemoveTeamMember,
  useUpdateTeamMemberRole,
} from '@/hooks/useTeams'
import { useTeamInvitations, useCreateInvitation, useCancelInvitation } from '@/hooks/useInvitations'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Building2, Pencil, UserMinus, Mail, Shield, User, Clock, X } from 'lucide-react'
import { toast } from 'sonner'
import type { TeamRole } from '@/types'

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
    return <p className="text-sm text-muted-foreground">No hay miembros</p>
  }

  return (
    <div className="space-y-2">
      {memberships.map((m) => (
        <div
          key={m.uid}
          className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{m.display_name}</p>
              <p className="text-xs text-muted-foreground truncate">{m.email}</p>
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
              className="h-7 w-7"
              onClick={() => handleRoleToggle(m.uid, m.role)}
              title={m.role === 'admin' ? 'Cambiar a miembro' : 'Cambiar a admin'}
            >
              {m.role === 'admin' ? (
                <User className="h-3.5 w-3.5" />
              ) : (
                <Shield className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => handleRemove(m.uid)}
              title="Remover del equipo"
            >
              <UserMinus className="h-3.5 w-3.5" />
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
        <Button size="sm" variant="outline">
          <Mail className="mr-1.5 h-3.5 w-3.5" />
          Invitar
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
    <div className="mt-3">
      <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        Invitaciones pendientes
      </p>
      <div className="space-y-1">
        {invitations.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="min-w-0">
                <p className="text-sm truncate">{inv.email}</p>
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
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => handleCancel(inv.id)}
              title="Cancelar invitación"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminTeams() {
  const { user } = useAuth()
  const { data: teams, isLoading } = useTeams()
  const createTeam = useCreateTeam()
  const updateTeam = useUpdateTeam()

  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const [editTeamId, setEditTeamId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleCreate = async () => {
    if (!newName.trim() || !user) {
      toast.error('Ingresa un nombre para el equipo')
      return
    }
    try {
      await createTeam.mutateAsync({
        name: newName.trim(),
        creator_uid: user.uid,
        creator_display_name: user.displayName || user.email || '',
        creator_email: user.email || '',
      })
      toast.success('Equipo creado')
      setCreateOpen(false)
      setNewName('')
    } catch {
      toast.error('Error al crear equipo')
    }
  }

  const handleEditName = async () => {
    if (!editTeamId || !editName.trim()) return
    try {
      await updateTeam.mutateAsync({ id: editTeamId, data: { name: editName.trim() } })
      toast.success('Nombre actualizado')
      setEditTeamId(null)
    } catch {
      toast.error('Error al actualizar nombre')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Equipos</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo equipo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear equipo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nombre del equipo</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Equipo Ventas Norte"
                  className="mt-1.5"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Serás el administrador de este equipo.
              </p>
              <Button
                onClick={handleCreate}
                disabled={createTeam.isPending}
                className="w-full"
              >
                {createTeam.isPending ? 'Creando...' : 'Crear equipo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando equipos...</p>
      ) : !teams || teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Building2 className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No hay equipos</p>
          <p className="text-sm mt-1">Crea el primer equipo para comenzar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => {
            const isEditing = editTeamId === team.id

            return (
              <Card key={team.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="max-w-xs"
                          onKeyDown={(e) => e.key === 'Enter' && handleEditName()}
                        />
                        <Button size="sm" onClick={handleEditName}>
                          Guardar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditTeamId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{team.name}</CardTitle>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditTeamId(team.id)
                            setEditName(team.name)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    <InviteMemberDialog teamId={team.id} teamName={team.name} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium mb-2">Miembros</p>
                  <TeamMembersList teamId={team.id} />
                  <PendingInvitationsList teamId={team.id} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
