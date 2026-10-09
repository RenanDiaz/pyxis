import { where, type QueryConstraint } from 'firebase/firestore'
import type { WorkspaceRole } from '@/types'

// ── Workspace context for role-based queries ──

export interface WorkspaceCtx {
  uid: string
  workspaceId: string
  role: WorkspaceRole
  subteamId: string | null
}

/**
 * Filtros por rol que exigen las reglas para listar clients/calls. Módulo
 * aparte de `firestore.ts` para poder usarlo con otra instancia (emulador).
 */
export function addWorkspaceRoleConstraints(ctx: WorkspaceCtx): QueryConstraint[] {
  if (ctx.role === 'owner') return []
  // Un supervisor sin subequipo solo ve lo suyo (las reglas no le dejan ver
  // los registros sin subequipo de otros).
  if (ctx.role === 'supervisor' && ctx.subteamId) {
    return [where('subteam_id', '==', ctx.subteamId)]
  }
  return [where('owner_uid', '==', ctx.uid)]
}
