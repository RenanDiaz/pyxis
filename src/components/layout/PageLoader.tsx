import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Fallback mientras se descarga el chunk de una página (spec 10). */
export default function PageLoader({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={cn('flex items-center justify-center', fullScreen ? 'min-h-dvh' : 'py-24')}
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}
