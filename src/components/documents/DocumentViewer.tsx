import type { ClientDocument } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

function isImage(fileType: string) {
  return fileType.startsWith('image/')
}

function isPdf(fileType: string) {
  return fileType === 'application/pdf'
}

interface Props {
  doc: ClientDocument | null
  onClose: () => void
}

export default function DocumentViewer({ doc, onClose }: Props) {
  if (!doc) return null

  const canPreview = isImage(doc.file_type) || isPdf(doc.file_type)

  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={
          canPreview
            ? 'sm:max-w-4xl max-h-[90vh] flex flex-col'
            : 'sm:max-w-md'
        }
      >
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{doc.name}</DialogTitle>
        </DialogHeader>

        {isImage(doc.file_type) && (
          <div className="flex-1 overflow-auto flex items-center justify-center min-h-0">
            <img
              src={doc.download_url}
              alt={doc.name}
              className="max-w-full max-h-[70vh] object-contain rounded-md"
            />
          </div>
        )}

        {isPdf(doc.file_type) && (
          <div className="flex-1 min-h-0">
            <iframe
              src={doc.download_url}
              title={doc.name}
              className="w-full h-[70vh] rounded-md border"
            />
          </div>
        )}

        {!canPreview && (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              No es posible previsualizar este tipo de archivo en el navegador.
            </p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button asChild variant="outline" size="sm">
            <a href={doc.download_url} target="_blank" rel="noopener noreferrer" download>
              <Download className="mr-2 h-3 w-3" />
              Descargar
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
