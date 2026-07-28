import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTaskSnapshot,
} from 'firebase/storage'
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore'
import { saveAs } from 'file-saver'
import { storage, db, isFirebaseConfigured } from '@/lib/firebase'
import type { DocFileType } from '@/types'
import { FileText, FileSpreadsheet, FileImage, File } from 'lucide-react'

// ── Helpers ──

const EXTENSION_MAP: Record<string, DocFileType> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  heic: 'image',
  pdf: 'pdf',
  doc: 'word',
  docx: 'word',
  xls: 'excel',
  xlsx: 'excel',
}

export function getFileType(filename: string): DocFileType {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_MAP[ext] ?? 'other'
}

export function getFileIcon(type: DocFileType) {
  switch (type) {
    case 'image':
      return FileImage
    case 'pdf':
      return FileText
    case 'word':
      return FileText
    case 'excel':
      return FileSpreadsheet
    default:
      return File
  }
}

export function getFileIconColor(type: DocFileType): string {
  switch (type) {
    case 'image':
      return 'text-purple-500'
    case 'pdf':
      return 'text-red-500'
    case 'word':
      return 'text-blue-500'
    case 'excel':
      return 'text-green-500'
    default:
      return 'text-muted-foreground'
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Descarga ──

export type DownloadResult = 'downloaded' | 'opened' | 'blocked'

/**
 * Descarga un archivo de Storage al disco del usuario.
 *
 * El atributo `download` de un `<a>` es ignorado por el navegador cuando el
 * href es de otro origen (Firebase Storage lo es), así que Chrome se limitaba a
 * abrir la imagen en una pestaña en vez de descargarla. Traemos el archivo como
 * blob y lo guardamos desde el mismo origen, que sí respeta el nombre y abre el
 * diálogo de descarga.
 *
 * Si el fetch falla (CORS del bucket sin configurar, red caída) caemos a abrir
 * la URL en una pestaña nueva — `'opened'` — y si el navegador bloquea el popup
 * devolvemos `'blocked'`.
 */
export async function downloadFile(url: string, filename: string): Promise<DownloadResult> {
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    saveAs(await response.blob(), filename)
    return 'downloaded'
  } catch {
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    return win ? 'opened' : 'blocked'
  }
}

// ── Upload / Delete ──

export interface UploadProgress {
  bytesTransferred: number
  totalBytes: number
  percent: number
}

export async function uploadClientFile(
  workspaceId: string,
  clientId: string,
  file: File,
  uploaderUid: string,
  uploaderName: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<string> {
  if (!isFirebaseConfigured || !storage || !db) throw new Error('Firebase no configurado')

  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `workspaces/${workspaceId}/clients/${clientId}/${timestamp}_${safeName}`
  const storageRef = ref(storage, storagePath)

  const downloadUrl = await new Promise<string>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    })

    task.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        onProgress?.({
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          percent: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        })
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        resolve(url)
      }
    )
  })

  const docRef = await addDoc(collection(db, 'workspaces', workspaceId, 'clients', clientId, 'documents'), {
    name: file.name,
    storage_path: storagePath,
    download_url: downloadUrl,
    type: getFileType(file.name),
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by_uid: uploaderUid,
    uploaded_by_name: uploaderName,
    uploaded_at: Timestamp.now(),
  })

  return docRef.id
}

export async function deleteClientFile(
  workspaceId: string,
  clientId: string,
  docId: string,
  storagePath: string
): Promise<void> {
  if (!isFirebaseConfigured || !storage || !db) throw new Error('Firebase no configurado')
  await deleteObject(ref(storage, storagePath))
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'clients', clientId, 'documents', docId))
}
