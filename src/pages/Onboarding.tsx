import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createWorkspace } from '@/lib/firestore'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

export default function Onboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [workspaceName, setWorkspaceName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim() || !user) return
    setCreating(true)
    try {
      await createWorkspace({
        name: workspaceName.trim(),
        owner_uid: user.uid,
        owner_display_name: user.displayName || user.email || '',
        owner_email: user.email || '',
      })
      await queryClient.invalidateQueries({ queryKey: ['userProfile'] })
      toast.success('Workspace creado')
      navigate('/')
    } catch {
      toast.error('Error al crear workspace')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Bienvenido a Pyxis</h1>
          <p className="text-muted-foreground">
            Para comenzar, crea un workspace o únete a uno existente.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Create workspace */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Crear workspace</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Crea un nuevo workspace para tu equipo de ventas.
              </p>
              <div>
                <Label>Nombre del workspace</Label>
                <Input
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Ej: Mi Empresa"
                  className="mt-1.5"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
                />
              </div>
              <Button
                onClick={handleCreateWorkspace}
                disabled={creating || !workspaceName.trim()}
                className="w-full"
              >
                {creating ? 'Creando...' : 'Crear workspace'}
              </Button>
            </CardContent>
          </Card>

          {/* Join workspace */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                  <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-lg">Unirse con invitación</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ingresa el código de invitación que recibiste por email.
              </p>
              <div>
                <Label>Código de invitación</Label>
                <Input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Pega el enlace o código aquí"
                  className="mt-1.5"
                />
              </div>
              <Button variant="outline" disabled className="w-full">
                Unirse al workspace
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Si recibiste un enlace de invitación, ábrelo directamente en tu navegador.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
