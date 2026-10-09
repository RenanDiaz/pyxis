import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { countMemberHoldings } from '@/lib/workspaceAdmin'
import { useRemoveMember } from '@/hooks/useWorkspace'
import type { WorkspaceMember } from '@/types'

interface Props {
  workspaceId: string
  member: WorkspaceMember
  members: WorkspaceMember[]
  /** Uid del owner que quita: destino por defecto de la reasignación. */
  currentUid: string
  onOpenChange: (open: boolean) => void
}

/**
 * Quitar un miembro obliga a decidir a quién pasan sus clientes y llamadas
 * (spec 06): antes quedaban con un `owner_uid` huérfano que solo veía el owner.
 */
export default function RemoveMemberDialog({ workspaceId, member, members, currentUid, onOpenChange }: Props) {
  const removeMember = useRemoveMember()
  const candidates = members.filter((m) => m.uid !== member.uid)
  const [targetUid, setTargetUid] = useState(currentUid)
  const { data: holdings, isLoading } = useQuery({
    queryKey: ['memberHoldings', workspaceId, member.uid],
    queryFn: () => countMemberHoldings(db!, workspaceId, member.uid),
    enabled: !!db,
  })

  const target = candidates.find((m) => m.uid === targetUid)
  const hasHoldings = !!holdings && holdings.clients + holdings.calls > 0

  const handleConfirm = async () => {
    if (!target) return
    const result = await removeMember.mutateAsync({
      workspaceId,
      uid: member.uid,
      target: { uid: target.uid, subteam_id: target.subteam_id },
    })
    toast.success(
      result.clients + result.calls > 0
        ? `${member.display_name} salió del workspace. ${result.clients} cliente(s) y ${result.calls} llamada(s) pasaron a ${target.display_name}.`
        : `${member.display_name} salió del workspace.`
    )
    onOpenChange(false)
  }

  return (
    <Dialog open onOpenChange={(o) => !removeMember.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quitar a {member.display_name}</DialogTitle>
          <DialogDescription>
            Deja de tener acceso al workspace. Al volver a entrar, se le pedirá crear o unirse a otro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {isLoading ? (
            <p className="text-muted-foreground">Contando sus clientes y llamadas…</p>
          ) : hasHoldings ? (
            <p>
              Tiene <strong>{holdings.clients} cliente(s)</strong> y{' '}
              <strong>{holdings.calls} llamada(s)</strong>. Pasarán a:
            </p>
          ) : (
            <p className="text-muted-foreground">No tiene clientes ni llamadas asignados.</p>
          )}
          {hasHoldings && (
            <div className="space-y-1.5">
              <Label htmlFor="reassign-target">Reasignar a</Label>
              <Select value={targetUid} onValueChange={setTargetUid}>
                <SelectTrigger id="reassign-target">
                  <SelectValue placeholder="Elige un miembro" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((m) => (
                    <SelectItem key={m.uid} value={m.uid}>
                      {m.display_name}
                      {m.uid === currentUid ? ' (tú)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={removeMember.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || !target || removeMember.isPending}
          >
            {removeMember.isPending ? 'Quitando…' : 'Quitar del workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
