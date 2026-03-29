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

  const filteredUsers = (users ?? []).filter((u) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      u.display_name.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s)
    )
  })

  const teamsMap = new Map(teams?.map((t) => [t.id, t.name]) ?? [])

  const getTeamNames = (teamIds: string[]) => {
    if (!teamIds || teamIds.length === 0) return ['Sin equipo']
    return teamIds.map((id) => teamsMap.get(id) || id)
  }

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    try {
      await updateUser.mutateAsync({ uid, data: { role: newRole } })
      toast.success(`Rol actualizado a ${ROLE_LABELS[newRole]}`)
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
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {getTeamNames(user.team_ids).map((name, i) => (
                        <span
                          key={i}
                          className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
                        >
                          {name}
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground">
                        Registro: {formatDate(user.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={user.role}
                      onValueChange={(v) => handleRoleChange(user.uid, v as UserRole)}
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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
