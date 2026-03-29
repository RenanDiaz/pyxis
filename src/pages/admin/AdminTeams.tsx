import { useState } from 'react'
import {
  useTeams,
  useCreateTeam,
  useUpdateTeam,
  useTeamMemberships,
  useAddTeamMember,
  useRemoveTeamMember,
  useUpdateTeamMemberRole,
} from '@/hooks/useTeams'
import { useAllUsers } from '@/hooks/useUsers'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { Plus, Building2, Pencil, UserMinus, UserPlus, Shield, User } from 'lucide-react'
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
          <div className="flex items-center gap-2">
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
      toast.success('Miembro agregado')
      setOpen(false)
      setSelectedUid('')
    } catch {
      toast.error('Error al agregar miembro')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          Agregar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar miembro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Usuario</Label>
            <Select value={selectedUid} onValueChange={setSelectedUid}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecciona usuario" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.uid} value={u.uid}>
                    {u.display_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                    <AddMemberDialog teamId={team.id} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium mb-2">Miembros</p>
                  <TeamMembersList teamId={team.id} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
