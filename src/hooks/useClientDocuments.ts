import { useState, useEffect } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import type { ClientDocument } from '@/types'

export function useClientDocuments(clientId: string | undefined) {
  const [documents, setDocuments] = useState<ClientDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!clientId || !isFirebaseConfigured || !db) {
      setDocuments([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const q = query(
      collection(db, 'clients', clientId, 'documents'),
      orderBy('uploaded_at', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ClientDocument[]
      setDocuments(docs)
      setIsLoading(false)
    })

    return unsubscribe
  }, [clientId])

  return { documents, isLoading }
}
