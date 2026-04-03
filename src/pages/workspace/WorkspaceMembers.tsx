import { useState } from 'react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useAuth } from '@/contexts/AuthContext'
import {
  useWorkspaceMembers,
  useUpdateMemberRole,
  useUpdateMemberSubteam,
  useRemoveMember,
  useSubteams,
} from '@/hooks/useWorkspace'
import {
  useWorkspaceInvitations,
  useCreateInvitation,
  useCancelInvitation,
} from '@/hooks/useWorkspaceInvitations'
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
} from '@/components/ui/dialog'
import { UserPlus, Trash2, Copy, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import type { WorkspaceRole } from '@/types'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  supervisor: 'Supervisor',
  agent: 'Agente',
}

export default function WorkspaceMembers() {
  const { workspaceId } = useUserProfile()
  const { user } = useAuth()
  const { data: members, isLoading } = useWorkspaceMembers(workspaceId)
  const { data: subteams } = useSubteams(workspaceId)
  const { data: invitations } = useWorkspaceInvitations(workspaceId)
  const updateRole = useUpdateMemberRole()
  const updateSubteam = useUpdateMemberSubteam()
  const removeMember = useRemoveMember()
  const createInvitation = useCreateInvitation()
  const cancelInvitation = useCancelInvitation()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'supervisor' | 'agent'>('agent')
  const [inviteSubteam, setInviteSubteam] = useState<string>('_none')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)

  const handleRoleChange = async (uid: string, role: WorkspaceRole) => {
    if (!workspaceId) return
    await updateRole.mutateAsync({ workspaceId, uid, role })
    toast.success('Rol actualizado')
  }

  const handleSubteamChange = async (uid: string, subteamId: string) => {
    if (!workspaceId) return
    await updateSubteam.mutateAsync({
      workspaceId,
      uid,
      subteamId: subteamId === '_none' ? null : subteamId,
    })
    toast.success('Subequipo actualizado')
  }

  const handleRemove = async (uid: string, name: string) => {
    if (!workspaceId) return
    if (!confirm(`¿Estás seguro de eliminar a ${name} del workspace?`)) return
    await removeMember.mutateAsync({ workspaceId, uid })
    toast.success('Miembro eliminado')
  }

  const handleInvite = async () => {
    if (!workspaceId || !inviteEmail.trim() || !user) return
    try {
      const inv = await createInvitation.mutateAsync({
        workspaceId,
        email: inviteEmail.trim(),
        role: inviteRole,
        subteamId: inviteSubteam === '_none' ? null : inviteSubteam,
        createdByUid: user.uid,
      })
      const link = `${window.location.origin}/join?token=${inv.token}&workspace=${workspaceId}`
      setGeneratedLink(link)
      toast.success('Invitación creada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear invitación')
    }
  }

  const handleCopyLink = () => {
    if (!generatedLink) return
    navigator.clipboard.writeText(generatedLink)
    toast.success('Enlace copiado')
  }

  const handleCancelInvitation = async (invitationId: string) => {
    if (!workspaceId) return
    await cancelInvitation.mutateAsync({ workspaceId, invitationId })
    toast.success('Invitación cancelada')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Miembros</h1>
        <Button onClick={() => { setInviteOpen(true); setGeneratedLink(null); setInviteEmail('') }}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invitar miembro
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Miembros del workspace ({members?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : !members?.length ? (
            <p className="text-muted-foreground">No hay miembros</p>
          ) : (
            <div className="space-y-3">
              {members.map((m) => (
                <div
                  key={m.uid}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 border-b pb-3 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{m.display_name}</p>
                    <p className="text-sm text-muted-foreground truncate">{m.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {m.role === 'owner' ? (
                      <span className="text-sm font-medium text-primary px-2">Owner</span>
                    ) : (
                      <>
                        <Select
                          value={m.role}
                          onValueChange={(v) => handleRoleChange(m.uid, v as WorkspaceRole)}
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                            <SelectItem value="agent">Agente</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={m.subteam_id ?? '_none'}
                          onValueChange={(v) => handleSubteamChange(m.uid, v)}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Sin subequipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Sin subequipo</SelectItem>
                            {subteams?.map((st) => (
                              <SelectItem key={st.id} value={st.id}>
                                {st.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemove(m.uid, m.display_name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {invitations && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Invitaciones pendientes ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Rol: {ROLE_LABELS[inv.role] ?? inv.role}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleCancelInvitation(inv.id)}
                  >
                    Cancelar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar miembro</DialogTitle>
          </DialogHeader>
          {generatedLink ? (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Comparte este enlace con el nuevo miembro:
              </p>
              <div className="flex items-center gap-2">
                <Input value={generatedLink} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                El enlace expira en 7 días.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setGeneratedLink(null); setInviteEmail('') }}
              >
                Invitar otro miembro
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Rol</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'supervisor' | 'agent')}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agente</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {subteams && subteams.length > 0 && (
                <div>
                  <Label>Subequipo (opcional)</Label>
                  <Select value={inviteSubteam} onValueChange={setInviteSubteam}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sin subequipo</SelectItem>
                      {subteams.map((st) => (
                        <SelectItem key={st.id} value={st.id}>
                          {st.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                onClick={handleInvite}
                disabled={createInvitation.isPending || !inviteEmail.trim()}
                className="w-full"
              >
                <Link2 className="mr-2 h-4 w-4" />
                {createInvitation.isPending ? 'Generando...' : 'Generar enlace de invitación'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
