import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LogOut, Mail, UserPlus } from 'lucide-react'

const SUPPORT_EMAIL = 'soporte@mipyxis.com'

/**
 * Usuario con sesión pero sin workspace. Los workspaces los crea un admin
 * global con `scripts/create-workspace.ts` (spec 22); desde aquí solo se entra
 * a uno existente abriendo el enlace de invitación (`/join?token=…`).
 */
export default function Onboarding() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Bienvenido a Pyxis</h1>
          <p className="text-muted-foreground">Tu cuenta aún no pertenece a ningún equipo.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-lg">Únete con una invitación</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Pide al dueño de tu equipo que te invite a{' '}
              <span className="font-semibold break-all">{user?.email}</span>.
            </p>
            <p className="text-muted-foreground">
              Cuando recibas el enlace de invitación, ábrelo en este navegador. La invitación
              tiene que ser para este mismo correo.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">¿Tu empresa aún no usa Pyxis?</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            Escríbenos a{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary underline-offset-4 hover:underline">
              {SUPPORT_EMAIL}
            </a>{' '}
            y te ayudamos a crear el espacio de tu equipo.
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="ghost" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión y entrar con otra cuenta
          </Button>
        </div>
      </div>
    </div>
  )
}
