import { NavLink } from 'react-router-dom'
import {
  Home,
  Map,
  Briefcase,
  Users,
  Calendar,
  BookOpen,
  UsersRound,
  Settings,
  Network,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserProfile } from '@/hooks/useUserProfile'

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

const workspaceNavItems: NavItem[] = [
  { to: '/workspace/miembros', label: 'Miembros', icon: UsersRound },
  { to: '/workspace/subteams', label: 'Subequipos', icon: Network },
  { to: '/workspace', label: 'Configuración', icon: Settings },
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

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  supervisor: 'Supervisor',
  agent: 'Agente',
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { role, workspace, profile } = useUserProfile()

  const showWorkspaceSection = role === 'owner'

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

        {showWorkspaceSection && (
          <NavSection title="Workspace" items={workspaceNavItems} onNavigate={onNavigate} />
        )}
      </nav>

      {/* Footer: workspace name + user info */}
      {workspace && (
        <div className="border-t px-4 py-3 space-y-1">
          <p className="text-xs font-semibold truncate">{workspace.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {profile?.display_name ?? ''} — {ROLE_LABELS[role] ?? role}
          </p>
        </div>
      )}
    </div>
  )
}
