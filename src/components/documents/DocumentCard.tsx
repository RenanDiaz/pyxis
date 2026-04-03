import type { ClientDocument, WorkspaceRole } from '@/types'
import {
  getFileIcon,
  getFileIconColor,
  formatFileSize,
} from '@/lib/storageUtils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Eye, Download, Trash2 } from 'lucide-react'

interface Props {
  doc: ClientDocument
  currentUid: string
  currentRole: WorkspaceRole
  onView: (doc: ClientDocument) => void
  onDelete: (doc: ClientDocument) => void
  deleting?: boolean
}

export default function DocumentCard({
  doc,
  currentUid,
  currentRole,
  onView,
  onDelete,
  deleting,
}: Props) {
  const Icon = getFileIcon(doc.type)
  const iconColor = getFileIconColor(doc.type)
  const canDelete = currentRole === 'owner' || doc.uploaded_by_uid === currentUid
  const uploadDate = doc.uploaded_at?.toDate?.()

  return (
    <div className="group relative flex flex-col rounded-lg border bg-card p-3 transition-shadow hover:shadow-md">
      {/* Thumbnail or icon */}
      <button
        type="button"
        className="flex h-28 w-full items-center justify-center rounded-md bg-muted/50 overflow-hidden cursor-pointer"
        onClick={() => onView(doc)}
      >
        {doc.type === 'image' ? (
          <img
            src={doc.download_url}
            alt={doc.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Icon className={`h-10 w-10 ${iconColor}`} />
        )}
      </button>

      {/* Type badge on thumbnail */}
      {doc.type === 'image' && (
        <span className="absolute top-4.5 left-4.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white uppercase">
          {doc.name.split('.').pop()}
        </span>
      )}

      {/* Info */}
      <div className="mt-2 w-full space-y-0.5">
        <p className="text-xs font-medium truncate" title={doc.name}>
          {doc.name}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatFileSize(doc.size_bytes)}
          {uploadDate && ` · ${uploadDate.toLocaleDateString('es-MX')}`}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {doc.uploaded_by_name}
        </p>
      </div>

      {/* Three-dot menu */}
      <div className="absolute top-1.5 right-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(doc)}>
              <Eye className="mr-2 h-4 w-4" />
              Abrir
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={doc.download_url} target="_blank" rel="noopener noreferrer" download>
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </a>
            </DropdownMenuItem>
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(doc)}
                  disabled={deleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
