import { useRef, useState, useCallback } from 'react'
import type { ClientDocument, UserRole } from '@/types'
import { useClientDocuments } from '@/hooks/useClientDocuments'
import {
  uploadClientFile,
  deleteClientFile,
  type UploadProgress,
} from '@/lib/storageUtils'
import DocumentCard from '@/components/documents/DocumentCard'
import DocumentViewer from '@/components/documents/DocumentViewer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic',
  'pdf',
  'doc', 'docx',
  'xls', 'xlsx',
]

function isAllowedFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED_EXTENSIONS.includes(ext)
}

interface FileUploadState {
  file: File
  progress: UploadProgress | null
  status: 'pending' | 'uploading' | 'done' | 'error'
}

interface Props {
  clientId: string
  currentUid: string
  currentRole: UserRole
  currentDisplayName: string
}

export default function DocumentGrid({
  clientId,
  currentUid,
  currentRole,
  currentDisplayName,
}: Props) {
  const { documents, isLoading } = useClientDocuments(clientId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [viewerDoc, setViewerDoc] = useState<ClientDocument | null>(null)
  const [uploads, setUploads] = useState<FileUploadState[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)

    // Validate all files first
    const invalid = fileArray.filter((f) => !isAllowedFile(f))
    if (invalid.length > 0) {
      toast.error(
        `Archivos no soportados: ${invalid.map((f) => f.name).join(', ')}. Usa imágenes, PDF, Word o Excel.`
      )
    }

    const oversize = fileArray.filter((f) => f.size > MAX_FILE_SIZE)
    if (oversize.length > 0) {
      toast.error(
        `Archivos exceden 20 MB: ${oversize.map((f) => f.name).join(', ')}`
      )
    }

    const valid = fileArray.filter((f) => isAllowedFile(f) && f.size <= MAX_FILE_SIZE)
    if (valid.length === 0) return

    // Initialize upload states
    const newUploads: FileUploadState[] = valid.map((file) => ({
      file,
      progress: null,
      status: 'pending',
    }))
    setUploads((prev) => [...prev, ...newUploads])

    // Upload each file
    for (let i = 0; i < valid.length; i++) {
      const file = valid[i]
      setUploads((prev) =>
        prev.map((u) =>
          u.file === file ? { ...u, status: 'uploading' } : u
        )
      )

      try {
        await uploadClientFile(
          clientId,
          file,
          currentUid,
          currentDisplayName,
          (progress) => {
            setUploads((prev) =>
              prev.map((u) =>
                u.file === file ? { ...u, progress } : u
              )
            )
          }
        )
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, status: 'done' } : u
          )
        )
      } catch {
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, status: 'error' } : u
          )
        )
        toast.error(`Error al subir "${file.name}"`)
      }
    }

    // Clear completed uploads after a short delay
    setTimeout(() => {
      setUploads((prev) => prev.filter((u) => u.status !== 'done'))
    }, 1500)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [clientId, currentUid, currentDisplayName, uploads.length])

  const handleDelete = async (doc: ClientDocument) => {
    if (!confirm(`¿Eliminar "${doc.name}"?`)) return
    setDeleting(true)
    try {
      await deleteClientFile(clientId, doc.id, doc.storage_path)
      toast.success('Documento eliminado')
    } catch {
      toast.error('Error al eliminar el documento')
    } finally {
      setDeleting(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    processFiles(e.dataTransfer.files)
  }

  const handleView = (doc: ClientDocument) => {
    if (doc.type === 'image') {
      setViewerDoc(doc)
    } else if (doc.type === 'pdf') {
      window.open(doc.download_url, '_blank')
    } else if (doc.type === 'word' || doc.type === 'excel') {
      window.open(
        `https://docs.google.com/viewer?url=${encodeURIComponent(doc.download_url)}&embedded=true`,
        '_blank'
      )
    } else {
      window.open(doc.download_url, '_blank')
    }
  }

  const activeUploads = uploads.filter((u) => u.status === 'uploading' || u.status === 'pending')
  const imageDocuments = documents.filter((d) => d.type === 'image')

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Documentos
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={activeUploads.length > 0}
          >
            <Upload className="mr-2 h-3 w-3" />
            Subir documento
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={(e) => e.target.files && processFiles(e.target.files)}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload progress */}
        {uploads.length > 0 && (
          <div className="space-y-2">
            {uploads.map((u, i) => (
              <div key={`${u.file.name}-${i}`} className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate mr-2">{u.file.name}</span>
                  <span className="text-muted-foreground text-xs shrink-0">
                    {u.status === 'uploading' && u.progress
                      ? `${u.progress.percent}%`
                      : u.status === 'done'
                        ? 'Listo'
                        : u.status === 'error'
                          ? 'Error'
                          : 'En espera'}
                  </span>
                </div>
                {u.status === 'uploading' && u.progress && (
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${u.progress.percent}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Drop zone when empty */}
        {!isLoading && documents.length === 0 && uploads.length === 0 && (
          <div
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <FolderOpen className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Arrastra archivos aquí o usa el botón "Subir documento"
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Imágenes, PDF, Word o Excel — máx. 20 MB
            </p>
          </div>
        )}

        {/* Document grid */}
        {documents.length > 0 && (
          <div
            className={`grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${
              dragOver ? 'ring-2 ring-primary/30 rounded-lg' : ''
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                currentUid={currentUid}
                currentRole={currentRole}
                onView={handleView}
                onDelete={handleDelete}
                deleting={deleting}
              />
            ))}
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">Cargando documentos...</p>
        )}
      </CardContent>

      {/* Image viewer modal */}
      <DocumentViewer
        doc={viewerDoc}
        allImages={imageDocuments}
        onClose={() => setViewerDoc(null)}
        onNavigate={setViewerDoc}
      />
    </Card>
  )
}
