import { useState } from 'react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useAuth } from '@/contexts/AuthContext'
import {
  useSubteams,
  useCreateSubteam,
  useUpdateSubteam,
  useDeleteSubteam,
  useWorkspaceMembers,
} from '@/hooks/useWorkspace'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'

export default function WorkspaceSubteams() {
  const { workspaceId } = useUserProfile()
  const { user } = useAuth()
  const { data: subteams, isLoading } = useSubteams(workspaceId)
  const { data: members } = useWorkspaceMembers(workspaceId)
  const createSubteam = useCreateSubteam()
  const updateSubteam = useUpdateSubteam()
  const deleteSubteam = useDeleteSubteam()

  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleCreate = async () => {
    if (!workspaceId || !user || !newName.trim()) return
    await createSubteam.mutateAsync({
      workspaceId,
      name: newName.trim(),
      createdBy: user.uid,
    })
    toast.success('Subequipo creado')
    setNewName('')
    setCreateOpen(false)
  }

  const handleUpdate = async () => {
    if (!workspaceId || !editId || !editName.trim()) return
    await updateSubteam.mutateAsync({
      workspaceId,
      subteamId: editId,
      name: editName.trim(),
    })
    toast.success('Subequipo actualizado')
    setEditId(null)
  }

  const handleDelete = async (subteamId: string, name: string) => {
    if (!workspaceId) return
    if (!confirm(`¿Eliminar el subequipo "${name}"?`)) return
    await deleteSubteam.mutateAsync({ workspaceId, subteamId })
    toast.success('Subequipo eliminado')
  }

  const getMembersForSubteam = (subteamId: string) =>
    members?.filter((m) => m.subteam_id === subteamId) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Subequipos</h1>
        <Button onClick={() => { setCreateOpen(true); setNewName('') }}>
          <Plus className="mr-2 h-4 w-4" />
          Crear subequipo
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !subteams?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No hay subequipos creados</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crea subequipos para organizar a tus agentes por grupo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {subteams.map((st) => {
            const stMembers = getMembersForSubteam(st.id)
            const supervisor = stMembers.find((m) => m.role === 'supervisor')
            return (
              <Card key={st.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{st.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditId(st.id); setEditName(st.name) }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(st.id, st.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {supervisor && (
                    <p className="text-sm text-muted-foreground">
                      Supervisor: {supervisor.display_name}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {stMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin miembros asignados</p>
                  ) : (
                    <div className="space-y-2">
                      {stMembers.map((m) => (
                        <div key={m.uid} className="flex items-center justify-between text-sm">
                          <span>{m.display_name}</span>
                          <span className="text-muted-foreground capitalize">{m.role}</span>
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

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear subequipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nombre del subequipo</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Equipo Norte"
                className="mt-1.5"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={createSubteam.isPending || !newName.trim()}
              className="w-full"
            >
              {createSubteam.isPending ? 'Creando...' : 'Crear subequipo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar subequipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nombre</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1.5"
                onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
              />
            </div>
            <Button
              onClick={handleUpdate}
              disabled={updateSubteam.isPending || !editName.trim()}
              className="w-full"
            >
              {updateSubteam.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
