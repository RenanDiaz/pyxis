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
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import type {
  Client,
  ClientStatus,
  Call,
  CallOutcome,
  UserProfile,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
  Subteam,
  WorkspaceInvitation,
  Goal,
  GoalType,
} from '@/types'

// ── Workspace context for role-based queries ──

export interface WorkspaceCtx {
  uid: string
  workspaceId: string
  role: WorkspaceRole
  subteamId: string | null
}

function addWorkspaceRoleConstraints(ctx: WorkspaceCtx): QueryConstraint[] {
  if (ctx.role === 'owner') return []
  if (ctx.role === 'supervisor') {
    return [where('subteam_id', '==', ctx.subteamId)]
  }
  return [where('owner_uid', '==', ctx.uid)]
}

// ── Helper: workspace collection path ──

function wsCol(workspaceId: string, sub: string) {
  return collection(db!, 'workspaces', workspaceId, sub)
}

function wsDoc(workspaceId: string, sub: string, docId: string) {
  return doc(db!, 'workspaces', workspaceId, sub, docId)
}

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
    workspace_id: null,
    created_at: serverTimestamp(),
  })
}

export async function updateUserWorkspace(uid: string, workspaceId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(doc(db, 'users', uid), { workspace_id: workspaceId })
}

// ── Workspaces ──

export async function getWorkspace(id: string): Promise<Workspace | null> {
  if (!isFirebaseConfigured || !db) return null
  const snap = await getDoc(doc(db, 'workspaces', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Workspace
}

export async function createWorkspace(data: {
  name: string
  owner_uid: string
  owner_display_name: string
  owner_email: string
}): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const batch = writeBatch(db)

  const wsRef = doc(collection(db, 'workspaces'))
  batch.set(wsRef, {
    name: data.name,
    owner_uid: data.owner_uid,
    created_at: serverTimestamp(),
  })

  const memberRef = doc(db, 'workspaces', wsRef.id, 'members', data.owner_uid)
  batch.set(memberRef, {
    uid: data.owner_uid,
    display_name: data.owner_display_name,
    email: data.owner_email,
    role: 'owner' as WorkspaceRole,
    subteam_id: null,
    joined_at: serverTimestamp(),
  })

  const userRef = doc(db, 'users', data.owner_uid)
  batch.update(userRef, { workspace_id: wsRef.id })

  await batch.commit()
  return wsRef.id
}

export async function updateWorkspace(
  id: string,
  data: Partial<Pick<Workspace, 'name' | 'owner_uid'>>
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(doc(db, 'workspaces', id), data)
}

export async function deleteWorkspace(id: string): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await deleteDoc(doc(db, 'workspaces', id))
}

// ── Workspace Members ──

export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(wsCol(workspaceId, 'members'), orderBy('joined_at', 'asc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => d.data() as WorkspaceMember)
}

export async function getWorkspaceMember(
  workspaceId: string,
  uid: string
): Promise<WorkspaceMember | null> {
  if (!isFirebaseConfigured || !db) return null
  const snap = await getDoc(wsDoc(workspaceId, 'members', uid))
  if (!snap.exists()) return null
  return snap.data() as WorkspaceMember
}

export async function updateMemberRole(
  workspaceId: string,
  uid: string,
  role: WorkspaceRole
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(wsDoc(workspaceId, 'members', uid), { role })
}

export async function updateMemberSubteam(
  workspaceId: string,
  uid: string,
  subteamId: string | null
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(wsDoc(workspaceId, 'members', uid), { subteam_id: subteamId })
}

export async function removeMember(workspaceId: string, uid: string): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const batch = writeBatch(db)
  batch.delete(wsDoc(workspaceId, 'members', uid))
  batch.update(doc(db, 'users', uid), { workspace_id: null })
  await batch.commit()
}

// ── Subteams ──

export async function getSubteams(workspaceId: string): Promise<Subteam[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(wsCol(workspaceId, 'subteams'), orderBy('created_at', 'asc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Subteam))
}

export async function createSubteam(
  workspaceId: string,
  data: { name: string; created_by: string }
): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const ref = await addDoc(wsCol(workspaceId, 'subteams'), {
    name: data.name,
    created_by: data.created_by,
    created_at: serverTimestamp(),
  })
  return ref.id
}

export async function updateSubteam(
  workspaceId: string,
  subteamId: string,
  data: Partial<Pick<Subteam, 'name'>>
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(wsDoc(workspaceId, 'subteams', subteamId), data)
}

export async function deleteSubteam(workspaceId: string, subteamId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await deleteDoc(wsDoc(workspaceId, 'subteams', subteamId))
}

// ── Workspace Invitations ──

export async function createInvitation(
  workspaceId: string,
  data: {
    email: string
    role: 'supervisor' | 'agent'
    subteam_id: string | null
    created_by_uid: string
  }
): Promise<WorkspaceInvitation> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')

  // Check for existing pending invitation
  const existing = query(
    wsCol(workspaceId, 'invitations'),
    where('email', '==', data.email.toLowerCase().trim()),
    where('status', '==', 'pending')
  )
  const existingSnap = await getDocs(existing)
  if (!existingSnap.empty) {
    throw new Error('Ya existe una invitación pendiente para este correo')
  }

  const token = crypto.randomUUID()
  const now = Timestamp.now()
  const expiresAt = Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const invData = {
    email: data.email.toLowerCase().trim(),
    role: data.role,
    subteam_id: data.subteam_id,
    token,
    status: 'pending' as const,
    created_by_uid: data.created_by_uid,
    created_at: now,
    expires_at: expiresAt,
  }

  const ref = await addDoc(wsCol(workspaceId, 'invitations'), invData)
  return { id: ref.id, ...invData }
}

export async function getInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(
    wsCol(workspaceId, 'invitations'),
    where('status', '==', 'pending'),
    orderBy('created_at', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as WorkspaceInvitation))
}

export async function getInvitationByToken(
  workspaceId: string,
  token: string
): Promise<WorkspaceInvitation | null> {
  if (!isFirebaseConfigured || !db) return null
  const q = query(
    wsCol(workspaceId, 'invitations'),
    where('token', '==', token),
    limit(1)
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  const d = snapshot.docs[0]
  return { id: d.id, ...d.data() } as WorkspaceInvitation
}

export async function acceptInvitation(
  workspaceId: string,
  invitationId: string,
  user: { uid: string; display_name: string; email: string }
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')

  const invRef = wsDoc(workspaceId, 'invitations', invitationId)
  const invSnap = await getDoc(invRef)
  if (!invSnap.exists()) throw new Error('Invitación no encontrada')
  const invitation = invSnap.data() as Omit<WorkspaceInvitation, 'id'>

  if (invitation.status !== 'pending') throw new Error('Esta invitación ya no está pendiente')

  const now = Timestamp.now()
  if (invitation.expires_at.toMillis() < now.toMillis()) {
    await updateDoc(invRef, { status: 'expired' })
    throw new Error('Esta invitación ha expirado')
  }

  const batch = writeBatch(db)

  batch.update(invRef, { status: 'accepted' })

  const memberRef = wsDoc(workspaceId, 'members', user.uid)
  batch.set(memberRef, {
    uid: user.uid,
    display_name: user.display_name,
    email: user.email,
    role: invitation.role,
    subteam_id: invitation.subteam_id,
    joined_at: serverTimestamp(),
  })

  const userRef = doc(db, 'users', user.uid)
  batch.update(userRef, { workspace_id: workspaceId })

  await batch.commit()
}

export async function cancelInvitation(workspaceId: string, invitationId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await deleteDoc(wsDoc(workspaceId, 'invitations', invitationId))
}

// ── Clients ──

interface ClientFilters {
  status?: ClientStatus
  search?: string
  archived?: boolean
}

export async function getClients(ctx: WorkspaceCtx, filters?: ClientFilters): Promise<Client[]> {
  if (!isFirebaseConfigured || !db) return []
  const constraints: QueryConstraint[] = [
    ...addWorkspaceRoleConstraints(ctx),
    orderBy('created_at', 'desc'),
  ]
  const showArchived = filters?.archived ?? false
  if (showArchived) {
    constraints.unshift(where('archived', '==', true))
  }
  if (filters?.status) {
    constraints.unshift(where('status', '==', filters.status))
  }
  const q = query(wsCol(ctx.workspaceId, 'clients'), ...constraints)
  const snapshot = await getDocs(q)
  let clients = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Client))
  if (!showArchived) {
    clients = clients.filter((c) => !c.archived)
  }
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

export async function getClientById(workspaceId: string, id: string): Promise<Client | null> {
  if (!isFirebaseConfigured || !db) return null
  const snap = await getDoc(wsDoc(workspaceId, 'clients', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Client
}

export async function createClient(
  ctx: WorkspaceCtx,
  data: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'owner_uid' | 'subteam_id'>,
  assignTo?: { owner_uid: string; subteam_id: string | null }
): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const now = Timestamp.now()
  const ref = await addDoc(wsCol(ctx.workspaceId, 'clients'), {
    ...data,
    archived: false,
    owner_uid: assignTo?.owner_uid ?? ctx.uid,
    subteam_id: assignTo?.subteam_id ?? ctx.subteamId,
    created_at: now,
    updated_at: now,
  })
  return ref.id
}

export async function updateClient(
  workspaceId: string,
  id: string,
  data: Partial<Omit<Client, 'id' | 'created_at'>>
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(wsDoc(workspaceId, 'clients', id), {
    ...data,
    updated_at: Timestamp.now(),
  })
}

export async function deleteClient(workspaceId: string, id: string): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await deleteDoc(wsDoc(workspaceId, 'clients', id))
}

export async function findClientsByPhone(workspaceId: string, phone: string): Promise<Client[]> {
  if (!isFirebaseConfigured || !db || !phone.trim()) return []
  const q = query(wsCol(workspaceId, 'clients'), where('phone', '==', phone.trim()))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Client))
}

// ── Calls ──

interface CallFilters {
  clientId?: string
  outcome?: CallOutcome
  fromDate?: Date
  toDate?: Date
}

export async function getCalls(ctx: WorkspaceCtx, filters?: CallFilters): Promise<Call[]> {
  if (!isFirebaseConfigured || !db) return []
  const constraints: QueryConstraint[] = [
    ...addWorkspaceRoleConstraints(ctx),
    orderBy('scheduled_at', 'asc'),
  ]
  if (filters?.clientId) {
    constraints.unshift(where('client_id', '==', filters.clientId))
  }
  if (filters?.outcome) {
    constraints.unshift(where('outcome', '==', filters.outcome))
  }
  const q = query(wsCol(ctx.workspaceId, 'calls'), ...constraints)
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

export async function getUpcomingCalls(ctx: WorkspaceCtx, max: number = 5): Promise<Call[]> {
  if (!isFirebaseConfigured || !db) return []
  const now = Timestamp.now()
  const constraints: QueryConstraint[] = [
    ...addWorkspaceRoleConstraints(ctx),
    where('outcome', '==', 'pendiente'),
    where('scheduled_at', '>=', now),
    orderBy('scheduled_at', 'asc'),
    limit(max),
  ]
  const q = query(wsCol(ctx.workspaceId, 'calls'), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Call))
}

export async function getOverdueCalls(ctx: WorkspaceCtx, max: number = 10): Promise<Call[]> {
  if (!isFirebaseConfigured || !db) return []
  const now = Timestamp.now()
  const constraints: QueryConstraint[] = [
    ...addWorkspaceRoleConstraints(ctx),
    where('outcome', '==', 'pendiente'),
    where('scheduled_at', '<', now),
    orderBy('scheduled_at', 'desc'),
    limit(max),
  ]
  const q = query(wsCol(ctx.workspaceId, 'calls'), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Call))
}

export async function createCall(
  ctx: WorkspaceCtx,
  data: Omit<Call, 'id' | 'created_at' | 'owner_uid' | 'subteam_id'>
): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const ref = await addDoc(wsCol(ctx.workspaceId, 'calls'), {
    ...data,
    owner_uid: ctx.uid,
    subteam_id: ctx.subteamId,
    created_at: Timestamp.now(),
  })
  return ref.id
}

export async function updateCall(
  workspaceId: string,
  id: string,
  data: Partial<Omit<Call, 'id' | 'created_at' | 'owner_uid'>>
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(wsDoc(workspaceId, 'calls', id), data)
}

// ── Goals ──

export async function getGoalsForAgent(
  workspaceId: string,
  targetUid: string,
  type: GoalType,
  period: string
): Promise<Goal[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(
    wsCol(workspaceId, 'goals'),
    where('target_uid', '==', targetUid),
    where('type', '==', type),
    where('period', '==', period),
    orderBy('created_at', 'desc'),
    limit(1)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Goal))
}

export async function getWorkspaceGoals(
  workspaceId: string,
  type: GoalType,
  period: string
): Promise<Goal[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(
    wsCol(workspaceId, 'goals'),
    where('type', '==', type),
    where('period', '==', period),
    orderBy('created_at', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Goal))
}

export async function createGoal(
  workspaceId: string,
  data: Omit<Goal, 'id' | 'created_at'>
): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const ref = await addDoc(wsCol(workspaceId, 'goals'), {
    ...data,
    created_at: serverTimestamp(),
  })
  return ref.id
}

// ── Dashboard helpers ──

export async function getRecentClients(ctx: WorkspaceCtx, max: number = 5): Promise<Client[]> {
  if (!isFirebaseConfigured || !db) return []
  const constraints: QueryConstraint[] = [
    ...addWorkspaceRoleConstraints(ctx),
    orderBy('created_at', 'desc'),
    limit(max),
  ]
  const q = query(wsCol(ctx.workspaceId, 'clients'), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Client))
}
