import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useDeleteWorkspace } from '@/hooks/useWorkspace'
import type { AdminProgress } from '@/lib/workspaceAdmin'
import type { Workspace } from '@/types'

interface Props {
  workspaceId: string
  workspace: Workspace
  ownerUid: string
  onOpenChange: (open: boolean) => void
}

const CONFIRM_WORD = 'ELIMINAR'

/**
 * Borrado completo del workspace desde el navegador (spec 06), con progreso.
 * Si se corta, se puede reintentar: continúa donde quedó.
 */
export default function DeleteWorkspaceDialog({ workspaceId, workspace, ownerUid, onOpenChange }: Props) {
  const deleteWs = useDeleteWorkspace()
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  const [progress, setProgress] = useState<AdminProgress | null>(null)

  const handleDelete = async () => {
    try {
      await deleteWs.mutateAsync({
        workspaceId,
        ownerUid,
        logoPath: workspace.receipt_logo_path ?? null,
        onProgress: setProgress,
      })
      toast.success('Workspace eliminado')
      navigate('/onboarding', { replace: true })
    } catch {
      // El toast con "puedes reintentar" lo muestra el handler global.
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !deleteWs.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">Eliminar «{workspace.name}»</DialogTitle>
          <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p>Se borrará de forma permanente:</p>
          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
            <li>Todos los clientes, con sus datos personales (incluido SSN/ITIN), procesos y pagos.</li>
            <li>Los documentos y archivos subidos de cada cliente.</li>
            <li>Las llamadas, metas, invitaciones y subequipos.</li>
            <li>El logo de los recibos.</li>
            <li>Los miembros: al entrar, a cada uno se le pedirá crear o unirse a otro workspace.</li>
          </ul>
          <p className="text-muted-foreground">
            Los recibos, cotizaciones y documentos ya descargados no se ven afectados.
          </p>

          {progress ? (
            <div role="status" className="rounded-md bg-muted/50 p-3">
              <p className="font-medium">
                {progress.step}
                {progress.total > 0 ? ` · ${progress.done} de ${progress.total}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">No cierres esta ventana.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-delete-ws">
                Escribe <strong>{CONFIRM_WORD}</strong> para confirmar
              </Label>
              <Input
                id="confirm-delete-ws"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleteWs.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteWs.isPending || (!deleteWs.isError && typed.trim() !== CONFIRM_WORD)}
          >
            {deleteWs.isPending ? 'Eliminando…' : deleteWs.isError ? 'Reintentar' : 'Eliminar workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
