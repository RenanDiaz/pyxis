import { useRef, useState } from 'react'
import type { ClientDocument, DocumentCategory } from '@/types'
import { useDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/useDocuments'
import DocumentCard from '@/components/documents/DocumentCard'
import DocumentViewer from '@/components/documents/DocumentViewer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: 'identificacion', label: 'Identificación' },
  { value: 'registro', label: 'Registro' },
  { value: 'legal', label: 'Legal' },
  { value: 'financiero', label: 'Financiero' },
  { value: 'otro', label: 'Otro' },
]

interface Props {
  clientId: string
}

export default function DocumentGrid({ clientId }: Props) {
  const { data: documents, isLoading } = useDocuments(clientId)
  const upload = useUploadDocument(clientId)
  const deleteMutation = useDeleteDocument(clientId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [viewerDoc, setViewerDoc] = useState<ClientDocument | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [category, setCategory] = useState<DocumentCategory>('otro')
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Tipo de archivo no soportado. Usa imágenes, PDF, Word o Excel.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('El archivo excede el límite de 10 MB.')
      return
    }

    setPendingFile(file)
  }

  const handleUpload = async () => {
    if (!pendingFile) return
    try {
      await upload.mutateAsync({ file: pendingFile, category })
      toast.success('Documento subido correctamente')
      setPendingFile(null)
      setCategory('otro')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      toast.error('Error al subir el documento')
    }
  }

  const handleCancelUpload = () => {
    setPendingFile(null)
    setCategory('otro')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (doc: ClientDocument) => {
    if (!confirm(`¿Eliminar "${doc.name}"?`)) return
    try {
      await deleteMutation.mutateAsync(doc)
      toast.success('Documento eliminado')
    } catch {
      toast.error('Error al eliminar el documento')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

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
            disabled={upload.isPending}
          >
            <Upload className="mr-2 h-3 w-3" />
            Subir archivo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pending file confirmation */}
        {pendingFile && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-medium">
              Archivo seleccionado: <span className="text-primary">{pendingFile.name}</span>
            </p>
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground">Categoría:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                className="rounded-md border bg-background px-2 py-1 text-sm"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleUpload} disabled={upload.isPending}>
                {upload.isPending
                  ? `Subiendo${upload.progress ? ` ${upload.progress.percent}%` : '...'}`
                  : 'Confirmar subida'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelUpload} disabled={upload.isPending}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Drop zone when empty */}
        {!isLoading && (!documents || documents.length === 0) && !pendingFile && (
          <div
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <FolderOpen className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Arrastra archivos aquí o usa el botón "Subir archivo"
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Imágenes, PDF, Word o Excel — máx. 10 MB
            </p>
          </div>
        )}

        {/* Document grid */}
        {documents && documents.length > 0 && (
          <div
            className={`grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${
              dragOver ? 'ring-2 ring-primary/30 rounded-lg' : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onView={setViewerDoc}
                onDelete={handleDelete}
                deleting={deleteMutation.isPending}
              />
            ))}
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">Cargando documentos...</p>
        )}
      </CardContent>

      {/* Viewer modal */}
      <DocumentViewer doc={viewerDoc} onClose={() => setViewerDoc(null)} />
    </Card>
  )
}
