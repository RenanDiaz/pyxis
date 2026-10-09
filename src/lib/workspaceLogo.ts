import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { isFirebaseConfigured } from '@/lib/firebase'
import { storage } from '@/lib/firebaseStorage'
import { UserFacingError } from '@/lib/errors'

// Separado de receiptUtils para que la configuración del workspace no cargue
// jsPDF (spec 10).

const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2 MB

export interface LogoUploadResult {
  url: string
  path: string
}

export async function uploadWorkspaceLogo(
  workspaceId: string,
  file: File
): Promise<LogoUploadResult> {
  if (!isFirebaseConfigured || !storage) throw new Error('Firebase no configurado')
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
    throw new UserFacingError('Formato no soportado. Usa PNG, JPG o WEBP.')
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new UserFacingError('El logo no puede superar los 2 MB.')
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const safeExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : 'png'
  const path = `workspaces/${workspaceId}/branding/logo_${Date.now()}.${safeExt}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: file.type })
  const url = await getDownloadURL(storageRef)
  return { url, path }
}

export async function deleteWorkspaceLogo(path: string): Promise<void> {
  if (!isFirebaseConfigured || !storage) return
  try {
    await deleteObject(ref(storage, path))
  } catch {
    // Ignore: file may already be gone
  }
}
