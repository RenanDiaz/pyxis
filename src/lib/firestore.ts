import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import type { Client, ClientStatus, Call, CallOutcome } from '@/types'

// ── Clients ──

interface ClientFilters {
  status?: ClientStatus
  search?: string
}

export async function getClients(filters?: ClientFilters): Promise<Client[]> {
  if (!isFirebaseConfigured || !db) return []
  const constraints: QueryConstraint[] = [orderBy('created_at', 'desc')]
  if (filters?.status) {
    constraints.unshift(where('status', '==', filters.status))
  }
  const q = query(collection(db, 'clients'), ...constraints)
  const snapshot = await getDocs(q)
  let clients = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Client))
  if (filters?.search) {
    const s = filters.search.toLowerCase()
    clients = clients.filter(
      (c) =>
        (c.first_name || '').toLowerCase().includes(s) ||
        (c.last_name || '').toLowerCase().includes(s) ||
        (c.llc_name || '').toLowerCase().includes(s) ||
        (c.state || '').toLowerCase().includes(s) ||
        c.phone.toLowerCase().includes(s)
    )
  }
  return clients
}

export async function getClientById(id: string): Promise<Client | null> {
  if (!isFirebaseConfigured || !db) return null
  const snap = await getDoc(doc(db, 'clients', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Client
}

export async function createClient(
  data: Omit<Client, 'id' | 'created_at' | 'updated_at'>
): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const now = Timestamp.now()
  const ref = await addDoc(collection(db, 'clients'), {
    ...data,
    created_at: now,
    updated_at: now,
  })
  return ref.id
}

export async function updateClient(
  id: string,
  data: Partial<Omit<Client, 'id' | 'created_at'>>
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(doc(db, 'clients', id), {
    ...data,
    updated_at: Timestamp.now(),
  })
}

export async function deleteClient(id: string): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await deleteDoc(doc(db, 'clients', id))
}

// ── Calls ──

interface CallFilters {
  clientId?: string
  outcome?: CallOutcome
  fromDate?: Date
  toDate?: Date
}

export async function getCalls(filters?: CallFilters): Promise<Call[]> {
  if (!isFirebaseConfigured || !db) return []
  const constraints: QueryConstraint[] = [orderBy('scheduled_at', 'asc')]
  if (filters?.clientId) {
    constraints.unshift(where('client_id', '==', filters.clientId))
  }
  if (filters?.outcome) {
    constraints.unshift(where('outcome', '==', filters.outcome))
  }
  const q = query(collection(db, 'calls'), ...constraints)
  const snapshot = await getDocs(q)
  let calls = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Call))
  if (filters?.fromDate) {
    const from = Timestamp.fromDate(filters.fromDate)
    calls = calls.filter((c) => c.scheduled_at >= from)
  }
  if (filters?.toDate) {
    const to = Timestamp.fromDate(filters.toDate)
    calls = calls.filter((c) => c.scheduled_at <= to)
  }
  return calls
}

export async function getUpcomingCalls(max: number = 5): Promise<Call[]> {
  if (!isFirebaseConfigured || !db) return []
  const now = Timestamp.now()
  const q = query(
    collection(db, 'calls'),
    where('outcome', '==', 'pendiente'),
    where('scheduled_at', '>=', now),
    orderBy('scheduled_at', 'asc'),
    limit(max)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Call))
}

export async function createCall(
  data: Omit<Call, 'id' | 'created_at'>
): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const ref = await addDoc(collection(db, 'calls'), {
    ...data,
    created_at: Timestamp.now(),
  })
  return ref.id
}

export async function updateCall(
  id: string,
  data: Partial<Omit<Call, 'id' | 'created_at'>>
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(doc(db, 'calls', id), data)
}

// ── Dashboard helpers ──

export async function getRecentClients(max: number = 5): Promise<Client[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(
    collection(db, 'clients'),
    orderBy('created_at', 'desc'),
    limit(max)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Client))
}
