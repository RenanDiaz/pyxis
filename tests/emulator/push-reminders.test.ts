import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { FirestoreRest } from '../../worker/firestore'
import { runPushReminders, type PushPayload } from '../../worker/pushReminders'
import type { PushSubscriptionKeys } from '../../worker/webPush'
import { createEnv, PROJECT_ID, seed, WS } from '../rules/setup'

// Cron de avisos con Pyxis cerrado (spec 21 fase 2) contra el emulador, con el
// cliente REST del Worker. "Bearer owner" es el admin del emulador, como la
// service account en producción.

let env: RulesTestEnvironment
const MIN = 60_000
const AT = Date.parse('2026-10-10T15:00:00Z') // 11:00 AM en Nueva York
const fs = new FirestoreRest({
  projectId: PROJECT_ID,
  baseUrl: `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'}/v1`,
  getToken: async () => 'owner',
})

interface Sent {
  endpoint: string
  payload: PushPayload
  ttl: number
}

function sender(statusFor: (endpoint: string) => number = () => 201) {
  const sent: Sent[] = []
  const send = async (sub: PushSubscriptionKeys, payload: string, opts: { ttl: number }) => {
    sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload), ttl: opts.ttl })
    return statusFor(sub.endpoint)
  }
  return { sent, send }
}

const run = (send: ReturnType<typeof sender>['send'], now: number) =>
  runPushReminders({ fs, send, now, log: () => {} })

async function write(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data))
}
async function read(path: string) {
  let data: Record<string, unknown> | undefined
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data()
  })
  return data
}

const call = (owner: string, extra: Record<string, unknown> = {}) => ({
  client_id: 'cAg',
  owner_uid: owner,
  subteam_id: 'A',
  outcome: 'pendiente',
  notes: 'Revisar EIN',
  scheduled_at: Timestamp.fromMillis(AT),
  ...extra,
})
const subscription = (endpoint: string) => ({
  endpoint,
  p256dh: 'x',
  auth: 'y',
  timezone: 'America/New_York',
})

before(async () => {
  env = await createEnv()
})
after(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await seed(env)
  await write(`workspaces/${WS}/clients/cAg`, { owner_uid: 'ag', subteam_id: 'A', first_name: 'Juan', last_name: 'Pérez', notes: '' })
  await write('users/ag/push_subscriptions/s1', subscription('https://fcm.googleapis.com/fcm/send/ag-chrome'))
  await write('users/ag2/push_subscriptions/s2', subscription('https://fcm.googleapis.com/fcm/send/ag2'))
})

describe('avisos por Web Push', () => {
  it('5 minutos antes y a la hora, solo al dueño de la llamada, una vez cada uno', async () => {
    await write(`workspaces/${WS}/calls/k1`, call('ag'))
    const { sent, send } = sender()

    assert.equal((await run(send, AT - 10 * MIN)).due, 0) // todavía no
    await run(send, AT - 5 * MIN + 20_000)
    assert.equal(sent.length, 1)
    assert.equal(sent[0].endpoint, 'https://fcm.googleapis.com/fcm/send/ag-chrome')
    assert.match(sent[0].payload.title, /^En 5 minutos: llamada con /)
    assert.match(sent[0].payload.title, /Juan/)
    assert.equal(sent[0].payload.body, '11:00 AM · Revisar EIN')
    assert.equal(sent[0].payload.url, '/clientes/cAg')
    assert.equal(sent[0].payload.tag, `k1:before:${AT}`)
    assert.equal(sent[0].payload.requireInteraction, false)
    assert.equal(sent[0].ttl, 300)

    await run(send, AT - 4 * MIN) // el minuto siguiente no repite
    assert.equal(sent.length, 1)

    await run(send, AT + 10_000)
    assert.equal(sent.length, 2)
    assert.match(sent[1].payload.title, /^Es la hora: /)
    assert.equal(sent[1].payload.requireInteraction, true)
    assert.deepEqual((await read(`workspaces/${WS}/calls/k1`))!.push_sent, [`k1:before:${AT}`, `k1:now:${AT}`])
  })

  it('una llamada reagendada vuelve a avisar a su nueva hora', async () => {
    await write(`workspaces/${WS}/calls/k1`, call('ag'))
    const { sent, send } = sender()
    await run(send, AT + 10_000)
    assert.equal(sent.length, 1)
    const later = AT + 30 * MIN
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), `workspaces/${WS}/calls/k1`), { scheduled_at: Timestamp.fromMillis(later) }),
    )
    await run(send, later + 10_000)
    assert.equal(sent.length, 2)
    assert.equal(sent[1].payload.tag, `k1:now:${later}`)
  })

  it('no avisa llamadas resueltas, intentos de contacto ni la colección vieja de nivel raíz', async () => {
    await write(`workspaces/${WS}/calls/done`, call('ag', { outcome: 'completada' }))
    await write(`workspaces/${WS}/calls/attempt`, call('ag', { kind: 'contact_attempt' }))
    await write('calls/legacy', call('ag'))
    const { sent, send } = sender()
    await run(send, AT + 10_000)
    assert.equal(sent.length, 0)
  })

  it('a un lead: su nombre y la Agenda', async () => {
    await write(`workspaces/${WS}/calls/l1`, call('ag', { client_id: null, lead: { name: 'María López', phone: 'x', phone_digits: '1' }, notes: '' }))
    const { sent, send } = sender()
    await run(send, AT + 10_000)
    assert.equal(sent[0].payload.title, 'Es la hora: llamada con María López')
    assert.equal(sent[0].payload.body, '11:00 AM · lead')
    assert.equal(sent[0].payload.url, '/agenda')
  })

  it('borra la suscripción que el servicio de push da por vencida (410)', async () => {
    await write(`workspaces/${WS}/calls/k1`, call('ag'))
    const { send } = sender(() => 410)
    const summary = await run(send, AT + 10_000)
    assert.equal(summary.removedSubscriptions, 1)
    assert.equal(await read('users/ag/push_subscriptions/s1'), undefined)
  })

  it('un fallo pasajero se reintenta el minuto siguiente', async () => {
    await write(`workspaces/${WS}/calls/k1`, call('ag'))
    let status = 503
    const { sent, send } = sender(() => status)
    await run(send, AT + 10_000)
    assert.equal((await read(`workspaces/${WS}/calls/k1`))!.push_sent, undefined)
    status = 201
    await run(send, AT + 70_000)
    assert.equal(sent.length, 2)
    assert.deepEqual((await read(`workspaces/${WS}/calls/k1`))!.push_sent, [`k1:now:${AT}`])
  })

  it('ignora endpoints que no son de un servicio de push', async () => {
    await write('users/ag/push_subscriptions/s1', subscription('https://evil.example.com/x'))
    await write(`workspaces/${WS}/calls/k1`, call('ag'))
    const { sent, send } = sender()
    await run(send, AT + 10_000)
    assert.equal(sent.length, 0)
  })
})
