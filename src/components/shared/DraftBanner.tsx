import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, History } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface DraftBannerProps {
  savedAt: number
  /** El registro cambió después del borrador: se ofrece restaurar o descartar. */
  conflict?: boolean
  onDiscard: () => void
  onRestore?: () => void
  /** Texto extra, p. ej. qué datos no se guardan en el borrador. */
  note?: string
}

export default function DraftBanner({ savedAt, conflict, onDiscard, onRestore, note }: DraftBannerProps) {
  const ago = formatDistanceToNow(savedAt, { addSuffix: true, locale: es })
  const Icon = conflict ? AlertTriangle : History

  return (
    <Alert className="border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30">
      <Icon className="h-4 w-4 text-sky-700 dark:text-sky-300" />
      <AlertDescription className="space-y-2 text-sky-900 dark:text-sky-200">
        <p>
          {conflict
            ? `Tienes un borrador sin guardar de ${ago}, pero el registro se modificó después. Si lo restauras podrías sobrescribir esos cambios.`
            : `Recuperamos un borrador sin guardar de ${ago}.`}
          {note && <span className="block text-xs opacity-80">{note}</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {conflict && onRestore && (
            <Button type="button" size="sm" onClick={onRestore}>
              Restaurar borrador
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={onDiscard}>
            Descartar borrador
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
