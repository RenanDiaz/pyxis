import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ClientDocument, DocumentCategory } from '@/types'
import { getDocuments, createDocument, deleteDocument } from '@/lib/firestore'
import { uploadFile, deleteFile, type UploadProgress } from '@/lib/storage'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'

export function useDocuments(clientId: string | undefined) {
  return useQuery<ClientDocument[]>({
    queryKey: ['documents', clientId],
    queryFn: () => getDocuments(clientId!),
    enabled: !!clientId,
  })
}

export function useUploadDocument(clientId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<UploadProgress | null>(null)

  const mutation = useMutation({
    mutationFn: async ({ file, category }: { file: File; category: DocumentCategory }) => {
      setProgress({ bytesTransferred: 0, totalBytes: file.size, percent: 0 })
      const { storagePath, downloadUrl } = await uploadFile(clientId, file, setProgress)
      await createDocument(clientId, {
        client_id: clientId,
        name: file.name,
        file_type: file.type,
        size: file.size,
        storage_path: storagePath,
        download_url: downloadUrl,
        category,
        uploaded_by: user?.uid ?? '',
      })
    },
    onSuccess: () => {
      setProgress(null)
      queryClient.invalidateQueries({ queryKey: ['documents', clientId] })
    },
    onError: () => {
      setProgress(null)
    },
  })

  return { ...mutation, progress }
}

export function useDeleteDocument(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (doc: ClientDocument) => {
      await deleteFile(doc.storage_path)
      await deleteDocument(clientId, doc.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', clientId] })
    },
  })
}
