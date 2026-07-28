import { useState } from 'react'
import { toast } from 'sonner'
import type { ClientDocument } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { downloadFile } from '@/lib/storageUtils'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  doc: ClientDocument | null
  allImages: ClientDocument[]
  onClose: () => void
  onNavigate: (doc: ClientDocument) => void
}

export default function DocumentViewer({ doc, allImages, onClose, onNavigate }: Props) {
  const [downloading, setDownloading] = useState(false)

  if (!doc) return null

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const result = await downloadFile(doc.download_url, doc.name)
      if (result === 'opened') {
        toast.warning('No se pudo descargar directamente. El archivo se abrió en otra pestaña.')
      } else if (result === 'blocked') {
        toast.error('El navegador bloqueó la descarga. Permite las ventanas emergentes e intenta de nuevo.')
      }
    } finally {
      setDownloading(false)
    }
  }

  const currentIndex = allImages.findIndex((d) => d.id === doc.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < allImages.length - 1

  const goPrev = () => {
    if (hasPrev) onNavigate(allImages[currentIndex - 1])
  }

  const goNext = () => {
    if (hasNext) onNavigate(allImages[currentIndex + 1])
  }

  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            {doc.name}
            {allImages.length > 1 && (
              <span className="text-muted-foreground text-sm font-normal ml-2">
                {currentIndex + 1} / {allImages.length}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex-1 overflow-auto flex items-center justify-center min-h-0">
          {/* Previous button */}
          {hasPrev && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full shadow-md"
              onClick={goPrev}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}

          <img
            src={doc.download_url}
            alt={doc.name}
            className="max-w-full max-h-[70vh] object-contain rounded-md"
          />

          {/* Next button */}
          {hasNext && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full shadow-md"
              onClick={goNext}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
            <Download className="mr-2 h-3 w-3" />
            {downloading ? 'Descargando...' : 'Descargar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
