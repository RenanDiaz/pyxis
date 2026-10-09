import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Cada query compuesta de `src/lib/firestore.ts` debe tener su índice en
// `firestore.indexes.json` (spec 12). Si cambias una query, actualiza esta
// lista: el emulador no exige índices, así que un faltante solo se ve en prod.

type Dir = 'ASCENDING' | 'DESCENDING'
interface Index {
  collectionGroup: string
  fields: { fieldPath: string; order: Dir }[]
}

const indexes: Index[] = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')).indexes

/** Filtros de rol de `addWorkspaceRoleConstraints`: owner · supervisor · agente. */
const ROLE = [[], ['subteam_id'], ['owner_uid']]

/** Subconjuntos de filtros opcionales. */
const combos = (opts: string[]): string[][] =>
  opts.reduce<string[][]>((acc, f) => acc.flatMap((c) => [c, [...c, f]]), [[]])

interface Shape {
  name: string
  collection: string
  equals: string[]
  orderBy: [string, Dir]
}

const shapes: Shape[] = [
  // getClients: status? archived? + rol, orden created_at desc (también getRecentClients)
  ...combos(['status', 'archived']).flatMap((opt) =>
    ROLE.map((role) => ({
      name: `getClients ${[...opt, ...role].join('+') || 'owner'}`,
      collection: 'clients',
      equals: [...opt, ...role],
      orderBy: ['created_at', 'DESCENDING'] as [string, Dir],
    }))
  ),
  // getCalls: client_id? + rol, orden scheduled_at asc
  ...combos(['client_id']).flatMap((opt) =>
    ROLE.map((role) => ({
      name: `getCalls ${[...opt, ...role].join('+') || 'owner'}`,
      collection: 'calls',
      equals: [...opt, ...role],
      orderBy: ['scheduled_at', 'ASCENDING'] as [string, Dir],
    }))
  ),
  // getUpcomingCalls (asc) y getOverdueCalls (desc): outcome + rol + rango en scheduled_at
  ...(['ASCENDING', 'DESCENDING'] as Dir[]).flatMap((dir) =>
    ROLE.map((role) => ({
      name: `${dir === 'ASCENDING' ? 'getUpcomingCalls' : 'getOverdueCalls'} ${role.join('+') || 'owner'}`,
      collection: 'calls',
      equals: ['outcome', ...role],
      orderBy: ['scheduled_at', dir] as [string, Dir],
    }))
  ),
  { name: 'getGoalsForAgent', collection: 'goals', equals: ['target_uid', 'type', 'period'], orderBy: ['created_at', 'DESCENDING'] },
  { name: 'getWorkspaceGoals', collection: 'goals', equals: ['type', 'period'], orderBy: ['created_at', 'DESCENDING'] },
  { name: 'getInvitations', collection: 'invitations', equals: ['status'], orderBy: ['created_at', 'DESCENDING'] },
]

/** Sin igualdades basta el índice automático de un campo. */
function needsComposite(shape: Shape) {
  return shape.equals.length > 0
}

/** Igualdades en cualquier orden, seguidas del campo de orden con su dirección. */
function covers(index: Index, shape: Shape): boolean {
  if (index.collectionGroup !== shape.collection) return false
  if (index.fields.length !== shape.equals.length + 1) return false
  const eq = index.fields.slice(0, -1).map((f) => f.fieldPath).sort()
  const last = index.fields[index.fields.length - 1]
  return (
    JSON.stringify(eq) === JSON.stringify([...shape.equals].sort()) &&
    last.fieldPath === shape.orderBy[0] &&
    last.order === shape.orderBy[1]
  )
}

describe('firestore.indexes.json', () => {
  for (const shape of shapes.filter(needsComposite)) {
    it(`cubre ${shape.name}`, () => {
      assert.ok(indexes.some((i) => covers(i, shape)), `falta índice para ${shape.name}`)
    })
  }
})
