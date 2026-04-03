import { useState, useEffect } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import { useUserProfile } from '@/hooks/useUserProfile'
import type { ClientDocument } from '@/types'

export function useClientDocuments(clientId: string | undefined) {
  const { workspaceId } = useUserProfile()
  const [documents, setDocuments] = useState<ClientDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!clientId || !workspaceId || !isFirebaseConfigured || !db) {
      setDocuments([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const q = query(
      collection(db, 'workspaces', workspaceId, 'clients', clientId, 'documents'),
      orderBy('uploaded_at', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ClientDocument[]
      setDocuments(docs)
      setIsLoading(false)
    }, (error) => {
      console.error('Error loading documents:', error)
      setDocuments([])
      setIsLoading(false)
    })

    return unsubscribe
  }, [clientId, workspaceId])

  return { documents, isLoading }
}
