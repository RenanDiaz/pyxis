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
  const key = clientId && workspaceId && isFirebaseConfigured && db ? `${workspaceId}/${clientId}` : null
  // El resultado guarda de qué cliente es: al cambiar de cliente, lo anterior
  // se descarta al derivar (sin setState síncrono en el effect).
  const [result, setResult] = useState<{ key: string; documents: ClientDocument[] } | null>(null)

  useEffect(() => {
    if (!key || !db) return
    const [wsId, cId] = key.split('/')
    const q = query(
      collection(db, 'workspaces', wsId, 'clients', cId, 'documents'),
      orderBy('uploaded_at', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const documents = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ClientDocument[]
      setResult({ key, documents })
    }, (error) => {
      console.error('Error loading documents:', error)
      setResult({ key, documents: [] })
    })

    return unsubscribe
  }, [key])

  const current = result?.key === key ? result : null
  return { documents: current?.documents ?? [], isLoading: !!key && !current }
}
