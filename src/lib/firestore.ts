import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  type QueryConstraint,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import type { Client, ClientStatus, Call, CallOutcome, UserProfile, UserRole, Team, ClientDocument } from '@/types'

// ── User Profiles ──

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!isFirebaseConfigured || !db) return null
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return snap.data() as UserProfile
}

export async function createUserProfile(profile: {
  uid: string
  email: string
  display_name: string
}): Promise<void> {
  if (!isFirebaseConfigured || !db) return
  await setDoc(doc(db, 'users', profile.uid), {
    uid: profile.uid,
    email: profile.email,
    display_name: profile.display_name,
    role: 'agent' as UserRole,
    team_id: null,
    created_at: serverTimestamp(),
  })
}

// ── All Users ──

export async function getAllUsers(): Promise<UserProfile[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(collection(db, 'users'), orderBy('created_at', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => d.data() as UserProfile)
}

export async function getTeamMembers(teamId: string): Promise<UserProfile[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(collection(db, 'users'), where('team_id', '==', teamId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => d.data() as UserProfile)
}

export async function updateUserProfile(
  uid: string,
  data: Partial<Pick<UserProfile, 'role' | 'team_id'>>
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(doc(db, 'users', uid), data)
}

// ── Teams ──

export async function getTeams(): Promise<Team[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(collection(db, 'teams'), orderBy('created_at', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Team))
}

export async function createTeam(data: { name: string; supervisor_uid: string }): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const ref = await addDoc(collection(db, 'teams'), {
    ...data,
    created_at: serverTimestamp(),
  })
  return ref.id
}

export async function updateTeam(
  id: string,
  data: Partial<Pick<Team, 'name' | 'supervisor_uid'>>
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(doc(db, 'teams', id), data)
}

// ── Role-based query helpers ──

interface RoleContext {
  uid: string
  role: UserRole
  team_id: string | null
}

function addRoleConstraints(role: UserRole, uid: string, teamId: string | null): QueryConstraint[] {
  if (role === 'admin') return []
  if (role === 'supervisor' && teamId) return [where('team_id', '==', teamId)]
  return [where('owner_uid', '==', uid)]
}

// ── Clients ──

interface ClientFilters {
  status?: ClientStatus
  search?: string
}

export async function getClients(ctx: RoleContext, filters?: ClientFilters): Promise<Client[]> {
  if (!isFirebaseConfigured || !db) return []
  const constraints: QueryConstraint[] = [
    ...addRoleConstraints(ctx.role, ctx.uid, ctx.team_id),
    orderBy('created_at', 'desc'),
  ]
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
        c.phone.toLowerCase().includes(s) ||
        (c.phones || []).some((p) => p.number.toLowerCase().includes(s))
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
  ctx: RoleContext,
  data: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'owner_uid' | 'team_id'>
): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const now = Timestamp.now()
  const ref = await addDoc(collection(db, 'clients'), {
    ...data,
    owner_uid: ctx.uid,
    team_id: ctx.team_id,
    created_at: now,
    updated_at: now,
  })
  return ref.id
}

export async function updateClient(
  id: string,
  data: Partial<Omit<Client, 'id' | 'created_at' | 'owner_uid'>>
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

export async function getCalls(ctx: RoleContext, filters?: CallFilters): Promise<Call[]> {
  if (!isFirebaseConfigured || !db) return []
  const constraints: QueryConstraint[] = [
    ...addRoleConstraints(ctx.role, ctx.uid, ctx.team_id),
    orderBy('scheduled_at', 'asc'),
  ]
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

export async function getUpcomingCalls(ctx: RoleContext, max: number = 5): Promise<Call[]> {
  if (!isFirebaseConfigured || !db) return []
  const now = Timestamp.now()
  const constraints: QueryConstraint[] = [
    ...addRoleConstraints(ctx.role, ctx.uid, ctx.team_id),
    where('outcome', '==', 'pendiente'),
    where('scheduled_at', '>=', now),
    orderBy('scheduled_at', 'asc'),
    limit(max),
  ]
  const q = query(collection(db, 'calls'), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Call))
}

export async function createCall(
  ctx: RoleContext,
  data: Omit<Call, 'id' | 'created_at' | 'owner_uid' | 'team_id'>
): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const ref = await addDoc(collection(db, 'calls'), {
    ...data,
    owner_uid: ctx.uid,
    team_id: ctx.team_id,
    created_at: Timestamp.now(),
  })
  return ref.id
}

export async function updateCall(
  id: string,
  data: Partial<Omit<Call, 'id' | 'created_at' | 'owner_uid'>>
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(doc(db, 'calls', id), data)
}

// ── Documents ──

export async function getDocuments(clientId: string): Promise<ClientDocument[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(
    collection(db, 'clients', clientId, 'documents'),
    orderBy('created_at', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ClientDocument))
}

export async function createDocument(
  clientId: string,
  data: Omit<ClientDocument, 'id' | 'created_at'>
): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const ref = await addDoc(collection(db, 'clients', clientId, 'documents'), {
    ...data,
    created_at: Timestamp.now(),
  })
  return ref.id
}

export async function deleteDocument(clientId: string, docId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await deleteDoc(doc(db, 'clients', clientId, 'documents', docId))
}

// ── Dashboard helpers ──

export async function getRecentClients(ctx: RoleContext, max: number = 5): Promise<Client[]> {
  if (!isFirebaseConfigured || !db) return []
  const constraints: QueryConstraint[] = [
    ...addRoleConstraints(ctx.role, ctx.uid, ctx.team_id),
    orderBy('created_at', 'desc'),
    limit(max),
  ]
  const q = query(collection(db, 'clients'), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Client))
}
