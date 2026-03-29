import { useState } from 'react'
import { useTeamContext } from '@/contexts/TeamContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useUserTeams, useCreateTeam } from '@/hooks/useTeams'
import { useAuth } from '@/contexts/AuthContext'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function TeamSelector() {
  const { user } = useAuth()
  const { team_ids } = useUserProfile()
  const { activeTeamId, setActiveTeamId } = useTeamContext()
  const { data: teams } = useUserTeams(team_ids)
  const createTeam = useCreateTeam()

  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const handleCreate = async () => {
    if (!newName.trim() || !user) return
    try {
      const teamId = await createTeam.mutateAsync({
        name: newName.trim(),
        creator_uid: user.uid,
        creator_display_name: user.displayName || user.email || '',
        creator_email: user.email || '',
      })
      setActiveTeamId(teamId)
      toast.success('Equipo creado')
      setCreateOpen(false)
      setNewName('')
    } catch {
      toast.error('Error al crear equipo')
    }
  }

  return (
    <>
      <Select
        value={activeTeamId || '__independent__'}
        onValueChange={(v) => {
          if (v === '__create__') {
            setCreateOpen(true)
          } else if (v === '__independent__') {
            setActiveTeamId(null)
          } else {
            setActiveTeamId(v)
          }
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Contexto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__independent__">Independiente</SelectItem>
          {teams?.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
          <SelectItem value="__create__">
            <span className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Crear equipo
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
              disabled={createTeam.isPending || !newName.trim()}
              className="w-full"
            >
              {createTeam.isPending ? 'Creando...' : 'Crear equipo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
