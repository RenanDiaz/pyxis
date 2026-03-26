import { useState, useMemo } from 'react'
import { useTeams, useCreateTeam, useUpdateTeam } from '@/hooks/useTeams'
import { useAllUsers, useUpdateUserProfile } from '@/hooks/useUsers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Plus, Building2, Pencil, UserMinus } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminTeams() {
  const { data: teams, isLoading } = useTeams()
  const { data: users } = useAllUsers()
  const createTeam = useCreateTeam()
  const updateTeam = useUpdateTeam()
  const updateUser = useUpdateUserProfile()

  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSupervisor, setNewSupervisor] = useState('')

  const [editTeamId, setEditTeamId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const supervisors = useMemo(
    () => users?.filter((u) => u.role === 'supervisor' || u.role === 'admin') ?? [],
    [users]
  )

  const getMembersByTeam = (teamId: string) => {
    return users?.filter((u) => u.team_id === teamId) ?? []
  }

  const getSupervisorName = (uid: string) => {
    const user = users?.find((u) => u.uid === uid)
    return user?.display_name || user?.email || 'No asignado'
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newSupervisor) {
      toast.error('Completa todos los campos')
      return
    }
    try {
      const teamId = await createTeam.mutateAsync({
        name: newName.trim(),
        supervisor_uid: newSupervisor,
      })
      // Assign supervisor role and team if needed
      const sup = users?.find((u) => u.uid === newSupervisor)
      if (sup && sup.role !== 'supervisor' && sup.role !== 'admin') {
        await updateUser.mutateAsync({
          uid: newSupervisor,
          data: { role: 'supervisor', team_id: teamId },
        })
      } else if (sup) {
        await updateUser.mutateAsync({
          uid: newSupervisor,
          data: { team_id: teamId },
        })
      }
      toast.success('Equipo creado')
      setCreateOpen(false)
      setNewName('')
      setNewSupervisor('')
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

  const handleRemoveMember = async (uid: string) => {
    try {
      await updateUser.mutateAsync({ uid, data: { team_id: null } })
      toast.success('Agente removido del equipo')
    } catch {
      toast.error('Error al remover agente')
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
                />
              </div>
              <div>
                <Label>Supervisor</Label>
                <Select value={newSupervisor} onValueChange={setNewSupervisor}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecciona supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((u) => (
                      <SelectItem key={u.uid} value={u.uid}>
                        {u.display_name || u.email}
                        {u.role !== 'supervisor' && u.role !== 'admin'
                          ? ' (se asignará rol supervisor)'
                          : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            const members = getMembersByTeam(team.id)
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
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Supervisor: {getSupervisorName(team.supervisor_uid)}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium mb-2">
                    Agentes ({members.length})
                  </p>
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay agentes asignados</p>
                  ) : (
                    <div className="space-y-2">
                      {members.map((member) => (
                        <div
                          key={member.uid}
                          className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50"
                        >
                          <div>
                            <p className="text-sm font-medium">{member.display_name}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                          {member.uid !== team.supervisor_uid && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveMember(member.uid)}
                              title="Remover del equipo"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
