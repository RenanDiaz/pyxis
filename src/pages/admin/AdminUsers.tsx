import { useState } from 'react'
import { useAllUsers, useUpdateUserProfile } from '@/hooks/useUsers'
import { useTeams } from '@/hooks/useTeams'
import { Card, CardContent } from '@/components/ui/card'
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
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import type { UserRole } from '@/types'

const ROLE_LABELS: Record<UserRole, string> = {
  agent: 'Agente',
  supervisor: 'Supervisor',
  admin: 'Admin',
}

const ROLE_COLORS: Record<UserRole, string> = {
  agent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  supervisor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export default function AdminUsers() {
  const { data: users, isLoading } = useAllUsers()
  const { data: teams } = useTeams()
  const updateUser = useUpdateUserProfile()
  const [search, setSearch] = useState('')
  const [supervisorDialog, setSupervisorDialog] = useState<{
    uid: string
    name: string
  } | null>(null)

  const filteredUsers = (users ?? []).filter((u) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      u.display_name.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s)
    )
  })

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return 'Sin equipo'
    return teams?.find((t) => t.id === teamId)?.name || 'Sin equipo'
  }

  const handleRoleChange = async (uid: string, name: string, newRole: UserRole) => {
    if (newRole === 'supervisor') {
      setSupervisorDialog({ uid, name })
      return
    }
    try {
      await updateUser.mutateAsync({ uid, data: { role: newRole } })
      toast.success(`Rol actualizado a ${ROLE_LABELS[newRole]}`)
    } catch {
      toast.error('Error al actualizar rol')
    }
  }

  const handleTeamChange = async (uid: string, teamId: string) => {
    try {
      await updateUser.mutateAsync({
        uid,
        data: { team_id: teamId === 'none' ? null : teamId },
      })
      toast.success('Equipo actualizado')
    } catch {
      toast.error('Error al actualizar equipo')
    }
  }

  const handleSupervisorAssign = async (teamId: string | null) => {
    if (!supervisorDialog) return
    try {
      await updateUser.mutateAsync({
        uid: supervisorDialog.uid,
        data: { role: 'supervisor', team_id: teamId },
      })
      toast.success('Rol actualizado a Supervisor')
      setSupervisorDialog(null)
    } catch {
      toast.error('Error al actualizar rol')
    }
  }

  const formatDate = (timestamp: { toDate?: () => Date }) => {
    if (!timestamp?.toDate) return '—'
    return timestamp.toDate().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>

      <div className="relative sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando usuarios...</p>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <UsersRound className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No hay usuarios</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <Card key={user.uid}>
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{user.display_name || 'Sin nombre'}</p>
                      <Badge variant="secondary" className={ROLE_COLORS[user.role]}>
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Equipo: {getTeamName(user.team_id)}</span>
                      <span>Registro: {formatDate(user.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Select
                      value={user.role}
                      onValueChange={(v) =>
                        handleRoleChange(user.uid, user.display_name, v as UserRole)
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agent">Agente</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={user.team_id || 'none'}
                      onValueChange={(v) => handleTeamChange(user.uid, v)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin equipo</SelectItem>
                        {teams?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!supervisorDialog} onOpenChange={() => setSupervisorDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar supervisor a equipo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {supervisorDialog?.name} será supervisor. ¿Deseas asignarlo a un equipo existente?
          </p>
          <div className="space-y-2 pt-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleSupervisorAssign(null)}
            >
              Sin equipo por ahora
            </Button>
            {teams?.map((t) => (
              <Button
                key={t.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleSupervisorAssign(t.id)}
              >
                {t.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
