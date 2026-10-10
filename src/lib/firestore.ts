import {
  collection,
  doc,
  getDocs,
  getDoc,
  getCountFromServer,
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
import { auth, db, isFirebaseConfigured } from '@/lib/firebase'
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
  StateInfo,
} from '@/types'
import { normalizeClientFields } from '@/lib/clientUtils'
import { runClientCreate, runClientMutation, runClientUpdate } from '@/lib/clientTransactions'
import type { StatusTrigger } from '@/lib/statusUtils'
import { initialStatusFields } from '@/lib/statusHistory'
import type { ClientChange, ClientMutation } from '@/lib/processMutations'
import { UserFacingError } from '@/lib/errors'

import { addWorkspaceRoleConstraints, type WorkspaceCtx } from '@/lib/roleScope'
export type { WorkspaceCtx }

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

/** El usuario quedó apuntando a un workspace del que ya no es miembro. */
export async function clearUserWorkspace(uid: string): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(doc(db, 'users', uid), { workspace_id: null })
}

// ── Workspaces ──

export async function getWorkspace(id: string): Promise<Workspace | null> {
  if (!isFirebaseConfigured || !db) return null
  const snap = await getDoc(doc(db, 'workspaces', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Workspace
}

export async function updateWorkspace(
  id: string,
  data: Partial<Pick<Workspace, 'name' | 'owner_uid' | 'receipt_company_name' | 'receipt_logo_url' | 'receipt_logo_path' | 'payment_instructions'>>
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(doc(db, 'workspaces', id), data)
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
    workspace_name: string
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
    throw new UserFacingError('Ya existe una invitación pendiente para este correo')
  }

  const token = crypto.randomUUID()
  const now = Timestamp.now()
  const expiresAt = Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const invData = {
    // Denormalizado: el invitado no puede leer el workspace hasta unirse.
    workspace_name: data.workspace_name,
    email: data.email.toLowerCase().trim(),
    role: data.role,
    subteam_id: data.subteam_id,
    token,
    status: 'pending' as const,
    created_by_uid: data.created_by_uid,
    created_at: now,
    expires_at: expiresAt,
  }

  // El doc ID es el token: las reglas dejan leer una invitación por ID a quien
  // tenga el link, sin permitir listar las del workspace.
  await setDoc(wsDoc(workspaceId, 'invitations', token), invData)
  return { id: token, ...invData }
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
  const snap = await getDoc(wsDoc(workspaceId, 'invitations', token))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as WorkspaceInvitation
}

export async function acceptInvitation(
  workspaceId: string,
  invitationId: string,
  user: { uid: string; display_name: string; email: string }
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')

  const invRef = wsDoc(workspaceId, 'invitations', invitationId)
  const invSnap = await getDoc(invRef)
  if (!invSnap.exists()) throw new UserFacingError('Invitación no encontrada')
  const invitation = invSnap.data() as Omit<WorkspaceInvitation, 'id'>

  if (invitation.status !== 'pending') throw new UserFacingError('Esta invitación ya no está pendiente')
  if (invitation.expires_at.toMillis() < Date.now()) {
    throw new UserFacingError('Esta invitación ha expirado')
  }
  if (invitation.email && invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new UserFacingError(`Esta invitación es para ${invitation.email}`)
  }

  // Todo en un batch: las reglas validan que el member se crea con el rol y
  // subequipo de una invitación pendiente que pasa a aceptada por este usuario.
  const batch = writeBatch(db)

  batch.update(invRef, {
    status: 'accepted',
    accepted_by: user.uid,
    accepted_at: serverTimestamp(),
  })

  const memberRef = wsDoc(workspaceId, 'members', user.uid)
  batch.set(memberRef, {
    uid: user.uid,
    display_name: user.display_name,
    email: user.email,
    role: invitation.role,
    subteam_id: invitation.subteam_id,
    invitation_id: invitationId,
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

// La búsqueda por texto no va aquí: se filtra en memoria con
// `filterClientsBySearch` para no leer Firestore en cada tecla (spec 10).
interface ClientFilters {
  status?: ClientStatus
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
  return runClientCreate(db, ctx.workspaceId, {
    ...normalizeClientFields(data),
    ...initialStatusFields(data.status, ctx.uid, now),
    archived: false,
    owner_uid: assignTo?.owner_uid ?? ctx.uid,
    subteam_id: assignTo?.subteam_id ?? ctx.subteamId,
    created_at: now,
    updated_at: now,
  })
}

export async function updateClient(
  workspaceId: string,
  id: string,
  data: Partial<Omit<Client, 'id' | 'created_at'>>,
  trigger?: StatusTrigger,
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  // Con `status` o `trigger`, el cambio queda en el historial (statusHistory.ts).
  await runClientUpdate(db, workspaceId, id, data, { trigger, by: currentUid() })
}

/** Cambios a procesos y pagos: transaccionales (ver `processMutations.ts`). */
export async function mutateClient(
  workspaceId: string,
  id: string,
  mutation: ClientMutation,
): Promise<ClientChange> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  return runClientMutation(db, workspaceId, id, mutation, currentUid())
}

function currentUid(): string | null {
  return auth?.currentUser?.uid ?? null
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

export async function getOverdueCalls(
  ctx: WorkspaceCtx,
  max: number = 10,
  // La campana solo mira las vencidas recientes (spec 20).
  since?: Date
): Promise<Call[]> {
  if (!isFirebaseConfigured || !db) return []
  const now = Timestamp.now()
  const constraints: QueryConstraint[] = [
    ...addWorkspaceRoleConstraints(ctx),
    where('outcome', '==', 'pendiente'),
    ...(since ? [where('scheduled_at', '>=', Timestamp.fromDate(since))] : []),
    where('scheduled_at', '<', now),
    orderBy('scheduled_at', 'desc'),
    limit(max),
  ]
  const q = query(wsCol(ctx.workspaceId, 'calls'), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Call))
}

/**
 * Llamadas pendientes PROPIAS en una ventana (avisos, spec 21). Filtra por
 * `owner_uid` también para owner/supervisor: el aviso es de quien llama.
 */
export async function getReminderCalls(ctx: WorkspaceCtx, from: Date, to: Date): Promise<Call[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(
    wsCol(ctx.workspaceId, 'calls'),
    where('owner_uid', '==', ctx.uid),
    where('outcome', '==', 'pendiente'),
    where('scheduled_at', '>=', Timestamp.fromDate(from)),
    where('scheduled_at', '<=', Timestamp.fromDate(to)),
    orderBy('scheduled_at', 'asc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Call))
}

/** Cuántas vencidas quedan antes de `before` (fuera de la ventana de la campana). */
export async function countOverdueBefore(ctx: WorkspaceCtx, before: Date): Promise<number> {
  if (!isFirebaseConfigured || !db) return 0
  const q = query(
    wsCol(ctx.workspaceId, 'calls'),
    ...addWorkspaceRoleConstraints(ctx),
    where('outcome', '==', 'pendiente'),
    where('scheduled_at', '<', Timestamp.fromDate(before))
  )
  return (await getCountFromServer(q)).data().count
}

export async function getCall(workspaceId: string, id: string): Promise<Call | null> {
  if (!isFirebaseConfigured || !db) return null
  const snap = await getDoc(wsDoc(workspaceId, 'calls', id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Call) : null
}

export async function createCall(
  ctx: WorkspaceCtx,
  data: Omit<Call, 'id' | 'created_at' | 'owner_uid' | 'subteam_id'>,
  // Owner/supervisor pueden agendar un lead para uno de sus agentes (spec 19).
  assignTo?: { owner_uid: string; subteam_id: string | null }
): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const ref = await addDoc(wsCol(ctx.workspaceId, 'calls'), {
    ...data,
    owner_uid: assignTo?.owner_uid ?? ctx.uid,
    subteam_id: assignTo?.subteam_id ?? ctx.subteamId,
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
    // Margen para descartar archivados en memoria: los clientes viejos no
    // tienen el campo `archived`, así que no sirve un where (spec 13).
    limit(max * 4),
  ]
  const q = query(wsCol(ctx.workspaceId, 'clients'), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() } as Client))
    .filter((c) => !c.archived)
    .slice(0, max)
}

// ── States (referencia global) ──

export async function isGlobalAdmin(uid: string): Promise<boolean> {
  if (!isFirebaseConfigured || !db) return false
  const snap = await getDoc(doc(db, 'admins', uid))
  return snap.exists()
}

export async function getStates(): Promise<StateInfo[]> {
  if (!isFirebaseConfigured || !db) return []
  const snapshot = await getDocs(collection(db, 'states'))
  return snapshot.docs.map((d) => d.data() as StateInfo)
}

export async function updateState(
  abbreviation: string,
  data: Partial<StateInfo>
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await setDoc(doc(db, 'states', abbreviation), data, { merge: true })
}
