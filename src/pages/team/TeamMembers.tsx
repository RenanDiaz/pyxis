import { useState } from 'react'
import {
  useTeamMemberships,
  useAddTeamMember,
  useRemoveTeamMember,
  useUpdateTeamMemberRole,
} from '@/hooks/useTeams'
import { useAllUsers } from '@/hooks/useUsers'
import { useTeamContext } from '@/contexts/TeamContext'
import { useUserTeams } from '@/hooks/useTeams'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { UserMinus, UserPlus, Shield, User, UsersRound } from 'lucide-react'
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
        <AddMemberDialog teamId={activeTeamId} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Miembros</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamMembersList teamId={activeTeamId} />
        </CardContent>
      </Card>
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

function AddMemberDialog({ teamId }: { teamId: string }) {
  const { data: users } = useAllUsers()
  const { data: memberships } = useTeamMemberships(teamId)
  const addMember = useAddTeamMember()
  const [open, setOpen] = useState(false)
  const [selectedUid, setSelectedUid] = useState('')

  const memberUids = new Set(memberships?.map((m) => m.uid) ?? [])
  const availableUsers = users?.filter((u) => !memberUids.has(u.uid)) ?? []

  const handleAdd = async () => {
    const user = users?.find((u) => u.uid === selectedUid)
    if (!user) return
    try {
      await addMember.mutateAsync({
        teamId,
        user: { uid: user.uid, display_name: user.display_name, email: user.email },
      })
      toast.success('Miembro agregado al equipo')
      setOpen(false)
      setSelectedUid('')
    } catch {
      toast.error('Error al agregar miembro')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Agregar miembro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar miembro al equipo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Usuario</Label>
            <Select value={selectedUid} onValueChange={setSelectedUid}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecciona un usuario" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No hay usuarios disponibles
                  </div>
                ) : (
                  availableUsers.map((u) => (
                    <SelectItem key={u.uid} value={u.uid}>
                      {u.display_name || u.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            El usuario será agregado como miembro. Puedes cambiar su rol después.
          </p>
          <Button
            onClick={handleAdd}
            disabled={!selectedUid || addMember.isPending}
            className="w-full"
          >
            {addMember.isPending ? 'Agregando...' : 'Agregar al equipo'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
