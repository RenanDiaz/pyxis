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
  arrayUnion,
  arrayRemove,
  type QueryConstraint,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import type {
  Client,
  ClientStatus,
  Call,
  CallOutcome,
  UserProfile,
  UserRole,
  Team,
  TeamRole,
  TeamMembership,
  TeamInvitation,
  InvitationStatus,
  Goal,
  GoalType,
} from '@/types'

// ── User Profiles ──

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!isFirebaseConfigured || !db) return null
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  // Backward compat: migrate old team_id to team_ids
  if (data.team_id !== undefined && !data.team_ids) {
    return { ...data, team_ids: data.team_id ? [data.team_id] : [] } as UserProfile
  }
  return data as UserProfile
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
    team_ids: [],
    created_at: serverTimestamp(),
  })
}

// ── All Users ──

export async function getAllUsers(): Promise<UserProfile[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(collection(db, 'users'), orderBy('created_at', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => {
    const data = d.data()
    if (data.team_id !== undefined && !data.team_ids) {
      return { ...data, team_ids: data.team_id ? [data.team_id] : [] } as UserProfile
    }
    return data as UserProfile
  })
}

export async function getTeamMembers(teamId: string): Promise<UserProfile[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(collection(db, 'users'), where('team_ids', 'array-contains', teamId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => d.data() as UserProfile)
}

export async function updateUserProfile(
  uid: string,
  data: Partial<Pick<UserProfile, 'role' | 'team_ids'>>
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

export async function getTeamsByIds(ids: string[]): Promise<Team[]> {
  if (!isFirebaseConfigured || !db || ids.length === 0) return []
  // Firestore 'in' supports up to 30 values
  const q = query(collection(db, 'teams'), where('__name__', 'in', ids))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Team))
}

export async function createTeam(data: {
  name: string
  creator_uid: string
  creator_display_name: string
  creator_email: string
}): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const batch = writeBatch(db)

  // Create team doc
  const teamRef = doc(collection(db, 'teams'))
  batch.set(teamRef, {
    name: data.name,
    created_by: data.creator_uid,
    created_at: serverTimestamp(),
  })

  // Create membership doc for creator as admin
  const memberRef = doc(db, 'teams', teamRef.id, 'members', data.creator_uid)
  batch.set(memberRef, {
    uid: data.creator_uid,
    team_id: teamRef.id,
    role: 'admin' as TeamRole,
    display_name: data.creator_display_name,
    email: data.creator_email,
    joined_at: serverTimestamp(),
  })

  // Add team to creator's team_ids
  const userRef = doc(db, 'users', data.creator_uid)
  batch.update(userRef, { team_ids: arrayUnion(teamRef.id) })

  await batch.commit()
  return teamRef.id
}

export async function updateTeam(
  id: string,
  data: Partial<Pick<Team, 'name'>>
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(doc(db, 'teams', id), data)
}

// ── Team Memberships ──

export async function getTeamMemberships(teamId: string): Promise<TeamMembership[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(collection(db, 'teams', teamId, 'members'), orderBy('joined_at', 'asc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => d.data() as TeamMembership)
}

export async function getUserTeamMembership(
  teamId: string,
  uid: string
): Promise<TeamMembership | null> {
  if (!isFirebaseConfigured || !db) return null
  const snap = await getDoc(doc(db, 'teams', teamId, 'members', uid))
  if (!snap.exists()) return null
  return snap.data() as TeamMembership
}

export async function addTeamMember(
  teamId: string,
  user: { uid: string; display_name: string; email: string },
  role: TeamRole = 'member'
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const batch = writeBatch(db)

  const memberRef = doc(db, 'teams', teamId, 'members', user.uid)
  batch.set(memberRef, {
    uid: user.uid,
    team_id: teamId,
    role,
    display_name: user.display_name,
    email: user.email,
    joined_at: serverTimestamp(),
  })

  const userRef = doc(db, 'users', user.uid)
  batch.update(userRef, { team_ids: arrayUnion(teamId) })

  await batch.commit()
}

export async function removeTeamMember(teamId: string, uid: string): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const batch = writeBatch(db)

  batch.delete(doc(db, 'teams', teamId, 'members', uid))
  const userRef = doc(db, 'users', uid)
  batch.update(userRef, { team_ids: arrayRemove(teamId) })

  await batch.commit()
}

export async function updateTeamMemberRole(
  teamId: string,
  uid: string,
  role: TeamRole
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(doc(db, 'teams', teamId, 'members', uid), { role })
}

// ── Team Invitations ──

export async function createTeamInvitation(data: {
  team_id: string
  team_name: string
  email: string
  role: TeamRole
  invited_by_uid: string
  invited_by_name: string
}): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  // Check if there's already a pending invitation for this email+team
  const existing = await getPendingInvitationByEmail(data.email, data.team_id)
  if (existing) throw new Error('Ya existe una invitación pendiente para este correo en este equipo')
  // Check if user is already a member
  const q = query(collection(db, 'users'), where('email', '==', data.email))
  const userSnap = await getDocs(q)
  if (!userSnap.empty) {
    const userDoc = userSnap.docs[0].data() as UserProfile
    const memberSnap = await getDoc(doc(db, 'teams', data.team_id, 'members', userDoc.uid))
    if (memberSnap.exists()) throw new Error('Este usuario ya es miembro del equipo')
  }
  const ref = await addDoc(collection(db, 'team_invitations'), {
    team_id: data.team_id,
    team_name: data.team_name,
    email: data.email.toLowerCase().trim(),
    role: data.role,
    status: 'pending' as InvitationStatus,
    invited_by_uid: data.invited_by_uid,
    invited_by_name: data.invited_by_name,
    created_at: serverTimestamp(),
  })
  return ref.id
}

export async function getTeamInvitations(teamId: string): Promise<TeamInvitation[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(
    collection(db, 'team_invitations'),
    where('team_id', '==', teamId),
    where('status', '==', 'pending'),
    orderBy('created_at', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as TeamInvitation))
}

export async function getPendingInvitationsForUser(email: string): Promise<TeamInvitation[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(
    collection(db, 'team_invitations'),
    where('email', '==', email.toLowerCase().trim()),
    where('status', '==', 'pending'),
    orderBy('created_at', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as TeamInvitation))
}

async function getPendingInvitationByEmail(
  email: string,
  teamId: string
): Promise<TeamInvitation | null> {
  if (!isFirebaseConfigured || !db) return null
  const q = query(
    collection(db, 'team_invitations'),
    where('email', '==', email.toLowerCase().trim()),
    where('team_id', '==', teamId),
    where('status', '==', 'pending')
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  const d = snapshot.docs[0]
  return { id: d.id, ...d.data() } as TeamInvitation
}

export async function acceptTeamInvitation(invitationId: string, user: {
  uid: string
  display_name: string
  email: string
}): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const invRef = doc(db, 'team_invitations', invitationId)
  const invSnap = await getDoc(invRef)
  if (!invSnap.exists()) throw new Error('Invitación no encontrada')
  const invitation = invSnap.data() as Omit<TeamInvitation, 'id'>

  if (invitation.status !== 'pending') throw new Error('Esta invitación ya no está pendiente')

  const batch = writeBatch(db)

  // Update invitation status
  batch.update(invRef, { status: 'accepted' as InvitationStatus })

  // Add user as team member
  const memberRef = doc(db, 'teams', invitation.team_id, 'members', user.uid)
  batch.set(memberRef, {
    uid: user.uid,
    team_id: invitation.team_id,
    role: invitation.role,
    display_name: user.display_name,
    email: user.email,
    joined_at: serverTimestamp(),
  })

  // Add team to user's team_ids
  const userRef = doc(db, 'users', user.uid)
  batch.update(userRef, { team_ids: arrayUnion(invitation.team_id) })

  await batch.commit()
}

export async function declineTeamInvitation(invitationId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await updateDoc(doc(db, 'team_invitations', invitationId), {
    status: 'declined' as InvitationStatus,
  })
}

export async function cancelTeamInvitation(invitationId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  await deleteDoc(doc(db, 'team_invitations', invitationId))
}

// ── Role-based query helpers ──

export interface RoleContext {
  uid: string
  globalRole: UserRole
  activeTeamId: string | null
  activeTeamRole: TeamRole | null
}

function addRoleConstraints(ctx: RoleContext): QueryConstraint[] {
  // Platform admin sees everything
  if (ctx.globalRole === 'admin') return []
  // Team context active and user is team admin → see all team data
  if (ctx.activeTeamId && ctx.activeTeamRole === 'admin') {
    return [where('team_id', '==', ctx.activeTeamId)]
  }
  // Team context active but user is regular member → only own data within team
  if (ctx.activeTeamId && ctx.activeTeamRole === 'member') {
    return [where('owner_uid', '==', ctx.uid)]
  }
  // Independent mode → only own data
  return [where('owner_uid', '==', ctx.uid)]
}

// ── Clients ──

interface ClientFilters {
  status?: ClientStatus
  search?: string
  archived?: boolean
}

export async function getClients(ctx: RoleContext, filters?: ClientFilters): Promise<Client[]> {
  if (!isFirebaseConfigured || !db) return []
  const constraints: QueryConstraint[] = [
    ...addRoleConstraints(ctx),
    orderBy('created_at', 'desc'),
  ]
  // Filter by archived status:
  // When showing archived, query for archived == true.
  // When showing non-archived (default), don't add a Firestore filter because
  // older documents may not have the 'archived' field at all, and Firestore's
  // equality check won't match documents where the field is missing.
  const showArchived = filters?.archived ?? false
  if (showArchived) {
    constraints.unshift(where('archived', '==', true))
  }
  if (filters?.status) {
    constraints.unshift(where('status', '==', filters.status))
  }
  const q = query(collection(db, 'clients'), ...constraints)
  const snapshot = await getDocs(q)
  let clients = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Client))
  // Client-side filter: exclude archived clients when not showing archived
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
    archived: false,
    owner_uid: ctx.uid,
    team_id: ctx.activeTeamId,
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

export async function findClientsByPhone(phone: string): Promise<Client[]> {
  if (!isFirebaseConfigured || !db || !phone.trim()) return []
  const q = query(collection(db, 'clients'), where('phone', '==', phone.trim()))
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

export async function getCalls(ctx: RoleContext, filters?: CallFilters): Promise<Call[]> {
  if (!isFirebaseConfigured || !db) return []
  const constraints: QueryConstraint[] = [
    ...addRoleConstraints(ctx),
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
    ...addRoleConstraints(ctx),
    where('outcome', '==', 'pendiente'),
    where('scheduled_at', '>=', now),
    orderBy('scheduled_at', 'asc'),
    limit(max),
  ]
  const q = query(collection(db, 'calls'), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Call))
}

export async function getOverdueCalls(ctx: RoleContext, max: number = 10): Promise<Call[]> {
  if (!isFirebaseConfigured || !db) return []
  const now = Timestamp.now()
  const constraints: QueryConstraint[] = [
    ...addRoleConstraints(ctx),
    where('outcome', '==', 'pendiente'),
    where('scheduled_at', '<', now),
    orderBy('scheduled_at', 'desc'),
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
    team_id: ctx.activeTeamId,
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

// ── Goals ──

export async function getGoalsForAgent(
  targetUid: string,
  type: GoalType,
  period: string
): Promise<Goal[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(
    collection(db, 'goals'),
    where('target_uid', '==', targetUid),
    where('type', '==', type),
    where('period', '==', period),
    orderBy('created_at', 'desc'),
    limit(1)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Goal))
}

export async function getTeamGoals(
  teamId: string,
  type: GoalType,
  period: string
): Promise<Goal[]> {
  if (!isFirebaseConfigured || !db) return []
  const q = query(
    collection(db, 'goals'),
    where('team_id', '==', teamId),
    where('type', '==', type),
    where('period', '==', period),
    orderBy('created_at', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Goal))
}

export async function createGoal(data: Omit<Goal, 'id' | 'created_at'>): Promise<string> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado')
  const ref = await addDoc(collection(db, 'goals'), {
    ...data,
    created_at: serverTimestamp(),
  })
  return ref.id
}

// ── Dashboard helpers ──

export async function getRecentClients(ctx: RoleContext, max: number = 5): Promise<Client[]> {
  if (!isFirebaseConfigured || !db) return []
  const constraints: QueryConstraint[] = [
    ...addRoleConstraints(ctx),
    orderBy('created_at', 'desc'),
    limit(max),
  ]
  const q = query(collection(db, 'clients'), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Client))
}
