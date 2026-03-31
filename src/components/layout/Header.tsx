import { useState } from 'react'
import { Menu, LogOut, Sun, Moon, Monitor, Bell, Check, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/contexts/AuthContext'
import { usePendingInvitations, useAcceptInvitation, useDeclineInvitation } from '@/hooks/useInvitations'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import TeamSelector from '@/components/layout/TeamSelector'
import { toast } from 'sonner'

interface HeaderProps {
  onMenuToggle: () => void
}

function InvitationsButton() {
  const { user } = useAuth()
  const { data: invitations } = usePendingInvitations(user?.email)
  const acceptInvitation = useAcceptInvitation()
  const declineInvitation = useDeclineInvitation()
  const [open, setOpen] = useState(false)

  const count = invitations?.length ?? 0

  const handleAccept = async (invitationId: string) => {
    if (!user) return
    try {
      await acceptInvitation.mutateAsync({
        invitationId,
        user: {
          uid: user.uid,
          display_name: user.displayName || user.email || '',
          email: user.email || '',
        },
      })
      toast.success('Te has unido al equipo')
      if (count <= 1) setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al aceptar invitación')
    }
  }

  const handleDecline = async (invitationId: string) => {
    try {
      await declineInvitation.mutateAsync(invitationId)
      toast.success('Invitación rechazada')
      if (count <= 1) setOpen(false)
    } catch {
      toast.error('Error al rechazar invitación')
    }
  }

  if (count === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {count}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitaciones pendientes</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {invitations?.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <p className="text-sm font-medium">{inv.team_name}</p>
                <p className="text-xs text-muted-foreground">
                  Invitado por {inv.invited_by_name}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 gap-1"
                  onClick={() => handleAccept(inv.id)}
                  disabled={acceptInvitation.isPending}
                >
                  <Check className="h-3.5 w-3.5" />
                  Aceptar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDecline(inv.id)}
                  disabled={declineInvitation.isPending}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user, signOut } = useAuth()
  const { setTheme, theme } = useTheme()

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      <TeamSelector />

      <InvitationsButton />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Cambiar tema</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTheme('light')}>
            <Sun className="mr-2 h-4 w-4" />
            Claro
            {theme === 'light' && <span className="ml-auto text-primary">&#10003;</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')}>
            <Moon className="mr-2 h-4 w-4" />
            Oscuro
            {theme === 'dark' && <span className="ml-auto text-primary">&#10003;</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')}>
            <Monitor className="mr-2 h-4 w-4" />
            Sistema
            {theme === 'system' && <span className="ml-auto text-primary">&#10003;</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline text-sm">
              {user?.displayName || user?.email}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
