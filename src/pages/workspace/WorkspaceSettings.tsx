import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useUpdateWorkspace, useTransferOwnership, useWorkspaceMembers } from '@/hooks/useWorkspace'
import { useAuth } from '@/contexts/AuthContext'
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
import ReceiptBrandingSection from '@/components/workspace/ReceiptBrandingSection'
import DeleteWorkspaceDialog from '@/components/workspace/DeleteWorkspaceDialog'

export default function WorkspaceSettings() {
  const { workspace, workspaceId } = useUserProfile()
  const { user } = useAuth()
  const { data: members } = useWorkspaceMembers(workspaceId)
  const updateWs = useUpdateWorkspace()
  const transfer = useTransferOwnership()
  const [deleteOpen, setDeleteOpen] = useState(false)
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
    const target = members?.find((m) => m.uid === newOwner)
    if (
      !confirm(
        `¿Transferir la propiedad a ${target?.display_name ?? 'este miembro'}? ` +
          'Pasarás a supervisor y ya no podrás administrar el workspace.'
      )
    )
      return
    try {
      await transfer.mutateAsync({ workspaceId, fromUid: user.uid, toUid: newOwner })
      toast.success('Propiedad transferida. Ahora eres supervisor.')
      navigate('/')
    } catch {
      // El toast de error lo muestra el handler global de mutaciones.
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
            <Label htmlFor="ws-settings-name">Nombre</Label>
            <Input
              id="ws-settings-name"
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

      {workspace && workspaceId && (
        <ReceiptBrandingSection workspace={workspace} workspaceId={workspaceId} />
      )}

      {otherMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transferir propiedad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Transfiere la propiedad del workspace a otro miembro. Tú pasarás a supervisor.
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
              disabled={!newOwner || transfer.isPending}
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
            Eliminar el workspace borra clientes, documentos, llamadas y miembros. No se puede deshacer.
          </p>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Eliminar workspace
          </Button>
        </CardContent>
      </Card>

      {deleteOpen && workspace && workspaceId && user && (
        <DeleteWorkspaceDialog
          workspaceId={workspaceId}
          workspace={workspace}
          ownerUid={user.uid}
          onOpenChange={setDeleteOpen}
        />
      )}
    </div>
  )
}
