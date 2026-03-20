import { NavLink } from 'react-router-dom'
import { Home, Map, Briefcase, Users, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/estados', label: 'Estados', icon: Map },
  { to: '/oficios', label: 'Oficios', icon: Briefcase },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/agenda', label: 'Agenda', icon: Calendar },
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

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-6">
        <div className="flex items-center gap-2.5">
          <PyxisLogo className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Pyxis</h1>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map(({ to, label, icon: Icon }) => (
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
      </nav>
    </div>
  )
}
