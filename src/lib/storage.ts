import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTaskSnapshot,
} from 'firebase/storage'
import { storage, isFirebaseConfigured } from '@/lib/firebase'

export interface UploadProgress {
  bytesTransferred: number
  totalBytes: number
  percent: number
}

export async function uploadFile(
  clientId: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ storagePath: string; downloadUrl: string }> {
  if (!isFirebaseConfigured || !storage) throw new Error('Firebase no configurado')

  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `documents/${clientId}/${timestamp}_${safeName}`
  const storageRef = ref(storage, storagePath)

  return new Promise((resolve, reject) => {
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
        const downloadUrl = await getDownloadURL(task.snapshot.ref)
        resolve({ storagePath, downloadUrl })
      }
    )
  })
}

export async function deleteFile(storagePath: string): Promise<void> {
  if (!isFirebaseConfigured || !storage) throw new Error('Firebase no configurado')
  const storageRef = ref(storage, storagePath)
  await deleteObject(storageRef)
}
