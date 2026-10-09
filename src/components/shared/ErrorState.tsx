import { CloudOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { describeError } from '@/lib/errors'

interface ErrorStateProps {
  error: unknown
  /** Qué no se pudo cargar, p. ej. "los clientes". */
  what: string
  onRetry: () => void
}

/** Estado de error de una lectura (spec 09): antes un error se veía como "no hay datos". */
export default function ErrorState({ error, what, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
      <CloudOff className="h-10 w-10 opacity-50" />
      <p className="text-lg font-medium text-foreground">No se pudieron cargar {what}</p>
      <p className="text-sm">{describeError(error, 'Revisa tu conexión e intenta de nuevo.')}</p>
      <Button variant="outline" className="mt-2" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  )
}
