import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNewVersionAvailable } from '@/hooks/useNewVersionAvailable'

/** Aviso fijo de nueva versión (spec 14). */
export default function UpdateBanner() {
  const { updateAvailable, reload, snooze } = useNewVersionAvailable()
  if (!updateAvailable) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-lg"
    >
      <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Hay una nueva versión de Pyxis</p>
        <p className="text-xs text-muted-foreground">
          Recarga para usarla. Si estás llenando un formulario, se guarda como borrador.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={snooze}>
          Más tarde
        </Button>
        <Button size="sm" onClick={reload}>
          Recargar
        </Button>
      </div>
    </div>
  )
}
