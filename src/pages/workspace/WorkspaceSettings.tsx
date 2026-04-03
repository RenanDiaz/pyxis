import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useUpdateWorkspace, useDeleteWorkspace, useWorkspaceMembers } from '@/hooks/useWorkspace'
import { useAuth } from '@/contexts/AuthContext'
import { updateWorkspace } from '@/lib/firestore'
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
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

export default function WorkspaceSettings() {
  const { workspace, workspaceId } = useUserProfile()
  const { user } = useAuth()
  const { data: members } = useWorkspaceMembers(workspaceId)
  const updateWs = useUpdateWorkspace()
  const deleteWs = useDeleteWorkspace()
  const navigate = useNavigate()

  const [name, setName] = useState(workspace?.name ?? '')
  const [newOwner, setNewOwner] = useState('')

  const handleSaveName = async () => {
    if (!workspaceId || !name.trim()) return
    await updateWs.mutateAsync({ id: workspaceId, data: { name: name.trim() } })
    toast.success('Nombre actualizado')
  }

  const handleTransferOwnership = async () => {
    if (!workspaceId || !newOwner || !user) return
    if (!confirm(`¿Estás seguro de transferir la propiedad del workspace a este miembro? Perderás el rol de owner.`)) return
    try {
      await updateWorkspace(workspaceId, { owner_uid: newOwner })
      toast.success('Propiedad transferida')
      navigate('/')
    } catch {
      toast.error('Error al transferir propiedad')
    }
  }

  const handleDelete = async () => {
    if (!workspaceId) return
    const confirm1 = prompt('Escribe ELIMINAR para confirmar la eliminación del workspace:')
    if (confirm1 !== 'ELIMINAR') return
    try {
      await deleteWs.mutateAsync(workspaceId)
      toast.success('Workspace eliminado')
      navigate('/')
    } catch {
      toast.error('Error al eliminar workspace')
    }
  }

  const otherMembers = members?.filter((m) => m.uid !== user?.uid) ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Configuración del workspace</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nombre del workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 max-w-sm"
            />
          </div>
          <Button
            onClick={handleSaveName}
            disabled={updateWs.isPending || !name.trim() || name === workspace?.name}
          >
            Guardar
          </Button>
        </CardContent>
      </Card>

      {otherMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transferir propiedad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Transfiere la propiedad del workspace a otro miembro. Perderás el rol de owner.
            </p>
            <Select value={newOwner} onValueChange={setNewOwner}>
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="Selecciona un miembro" />
              </SelectTrigger>
              <SelectContent>
                {otherMembers.map((m) => (
                  <SelectItem key={m.uid} value={m.uid}>
                    {m.display_name} ({m.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleTransferOwnership}
              disabled={!newOwner}
            >
              Transferir propiedad
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Zona de peligro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Separator />
          <p className="text-sm text-muted-foreground">
            Eliminar el workspace borrará todos los datos asociados. Esta acción no se puede deshacer.
          </p>
          <Button variant="destructive" onClick={handleDelete}>
            Eliminar workspace
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
