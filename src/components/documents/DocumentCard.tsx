import type { ClientDocument } from '@/types'
import { FileText, FileSpreadsheet, FileImage, File, Trash2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

function isImage(fileType: string) {
  return fileType.startsWith('image/')
}

function isPdf(fileType: string) {
  return fileType === 'application/pdf'
}

function isWord(fileType: string) {
  return (
    fileType === 'application/msword' ||
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
}

function isExcel(fileType: string) {
  return (
    fileType === 'application/vnd.ms-excel' ||
    fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
}

function FileIcon({ fileType }: { fileType: string }) {
  const className = 'h-10 w-10'
  if (isPdf(fileType)) return <FileText className={`${className} text-red-500`} />
  if (isWord(fileType)) return <FileText className={`${className} text-blue-500`} />
  if (isExcel(fileType)) return <FileSpreadsheet className={`${className} text-green-500`} />
  if (isImage(fileType)) return <FileImage className={`${className} text-purple-500`} />
  return <File className={`${className} text-muted-foreground`} />
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const CATEGORY_LABELS: Record<string, string> = {
  identificacion: 'Identificación',
  registro: 'Registro',
  legal: 'Legal',
  financiero: 'Financiero',
  otro: 'Otro',
}

interface Props {
  doc: ClientDocument
  onView: (doc: ClientDocument) => void
  onDelete: (doc: ClientDocument) => void
  deleting?: boolean
}

export default function DocumentCard({ doc, onView, onDelete, deleting }: Props) {
  return (
    <div className="group relative flex flex-col items-center rounded-lg border bg-card p-3 transition-shadow hover:shadow-md">
      {/* Thumbnail or icon */}
      <button
        type="button"
        className="flex h-28 w-full items-center justify-center rounded-md bg-muted/50 overflow-hidden cursor-pointer"
        onClick={() => onView(doc)}
      >
        {isImage(doc.file_type) ? (
          <img
            src={doc.download_url}
            alt={doc.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <FileIcon fileType={doc.file_type} />
        )}
      </button>

      {/* Info */}
      <div className="mt-2 w-full text-center space-y-0.5">
        <p className="text-xs font-medium truncate" title={doc.name}>
          {doc.name}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatSize(doc.size)} · {CATEGORY_LABELS[doc.category] || doc.category}
        </p>
      </div>

      {/* Actions */}
      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={() => onView(doc)}
          title="Ver documento"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          className="h-7 w-7"
          onClick={() => onDelete(doc)}
          disabled={deleting}
          title="Eliminar documento"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
