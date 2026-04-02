import { NavLink } from 'react-router-dom'
import {
  Home,
  Map,
  Briefcase,
  Users,
  Calendar,
  BookOpen,
  UsersRound,
  BarChart3,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useTeamContext } from '@/contexts/TeamContext'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const agentNavItems: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/estados', label: 'Estados', icon: Map },
  { to: '/oficios', label: 'Oficios', icon: Briefcase },
  { to: '/glosario', label: 'Glosario', icon: BookOpen },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/agenda', label: 'Agenda', icon: Calendar },
]

const teamNavItems: NavItem[] = [
  { to: '/equipo/clientes', label: 'Clientes del equipo', icon: Users },
  { to: '/equipo/agenda', label: 'Agenda del equipo', icon: Calendar },
  { to: '/equipo/metricas', label: 'Métricas', icon: BarChart3 },
  { to: '/equipo/miembros', label: 'Miembros', icon: UsersRound },
]

const adminNavItems: NavItem[] = [
  { to: '/admin/usuarios', label: 'Usuarios', icon: UsersRound },
  { to: '/admin/equipos', label: 'Equipos', icon: Building2 },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/agenda', label: 'Agenda', icon: Calendar },
]

function PyxisLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="32" cy="32" r="30" fill="currentColor" />
      <path
        d="M32 8 L36.5 26 L54 32 L36.5 38 L32 56 L27.5 38 L10 32 L27.5 26 Z"
        fill="white"
        opacity="0.95"
      />
      <circle cx="32" cy="32" r="3.5" fill="currentColor" />
    </svg>
  )
}

function NavSection({ title, items, onNavigate }: { title?: string; items: NavItem[]; onNavigate?: () => void }) {
  return (
    <div>
      {title && (
        <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          {title}
        </p>
      )}
      <div className="space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useUserProfile()
  const { activeTeamId, activeTeamRole } = useTeamContext()

  const showTeamSection = !!activeTeamId && activeTeamRole === 'admin'
  const showAdminSection = role === 'admin'

  return (
    <div className="flex h-full flex-col">
      <div className="p-6">
        <div className="flex items-center gap-2.5">
          <PyxisLogo className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Pyxis</h1>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3">
        <NavSection items={agentNavItems} onNavigate={onNavigate} />

        {showTeamSection && (
          <NavSection title="Mi Equipo" items={teamNavItems} onNavigate={onNavigate} />
        )}

        {showAdminSection && (
          <NavSection title="Administración" items={adminNavItems} onNavigate={onNavigate} />
        )}
      </nav>
    </div>
  )
}
