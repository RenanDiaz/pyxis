import { dueReminders, REMINDER_GRACE_MS, REMINDER_LEAD_MS, type DueReminder } from '@/lib/callReminders'
import { getCallDisplayName, isLeadCall } from '@/lib/leads'
import type { Call, Client } from '@/types'
import type { FirestoreDoc, FirestoreRest } from './firestore'
import { isAllowedPushEndpoint, type PushSubscriptionKeys, type SendOptions } from './webPush'

// Avisos de llamadas con Pyxis cerrado (spec 21 fase 2). El cron del Worker
// corre esto cada minuto: busca las llamadas pendientes cuyo aviso toca
// ahora (misma lógica que la fase 1, `dueReminders`), manda un Web Push a
// cada navegador suscrito del dueño de la llamada y anota el aviso en
// `push_sent` para no repetirlo.

/** Campo de la llamada con las claves de aviso ya procesadas (`reminderKey`). */
export const PUSH_SENT_FIELD = 'push_sent'

const CALL_PATH = /^workspaces\/([^/]+)\/calls\/[^/]+$/

export interface StoredSubscription extends PushSubscriptionKeys {
  /** Zona horaria del navegador, para mostrar la hora como la ve el agente. */
  timezone?: string
}

export interface PushPayload {
  title: string
  body: string
  /** Igual a la `tag` de la fase 1: el navegador no muestra dos veces el mismo aviso. */
  tag: string
  url: string
  /** "Es la hora" queda en pantalla hasta cerrarla, como el toast de la fase 1. */
  requireInteraction: boolean
}

export interface PushReminderDeps {
  fs: FirestoreRest
  send: (sub: PushSubscriptionKeys, payload: string, opts: SendOptions) => Promise<number>
  now: number
  log?: (message: string) => void
}

export interface PushReminderSummary {
  due: number
  sent: number
  failed: number
  removedSubscriptions: number
}

/** La consulta: pendientes en la ventana donde puede tocar algún aviso. */
export function reminderQuery(now: number): Record<string, unknown> {
  const ts = (ms: number) => ({ timestampValue: new Date(ms).toISOString() })
  const field = (fieldPath: string, op: string, value: unknown) => ({
    fieldFilter: { field: { fieldPath }, op, value },
  })
  return {
    from: [{ collectionId: 'calls', allDescendants: true }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          field('outcome', 'EQUAL', { stringValue: 'pendiente' }),
          // "Es la hora" atrasada hasta GRACE; "en 5 minutos" hasta LEAD por delante.
          field('scheduled_at', 'GREATER_THAN_OR_EQUAL', ts(now - REMINDER_GRACE_MS)),
          field('scheduled_at', 'LESS_THAN_OR_EQUAL', ts(now + REMINDER_LEAD_MS + 60_000)),
        ],
      },
    },
  }
}

function formatTime(date: Date, timeZone: string | undefined): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true }
  try {
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone }).format(date)
  } catch {
    // Zona inválida guardada por un navegador viejo: hora de Nueva York.
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'America/New_York' }).format(date)
  }
}

export function buildPayload(reminder: DueReminder, name: string, timeZone?: string): PushPayload {
  const { call, kind, key } = reminder
  const notes = call.notes?.trim()
  const shortNotes = notes && notes.length > 80 ? `${notes.slice(0, 79)}…` : notes
  return {
    title: kind === 'before' ? `En 5 minutos: llamada con ${name}` : `Es la hora: llamada con ${name}`,
    body: `${formatTime(call.scheduled_at.toDate(), timeZone)}${isLeadCall(call) ? ' · lead' : ''}${shortNotes ? ` · ${shortNotes}` : ''}`,
    tag: key,
    // Un lead no tiene ficha: se gestiona desde la Agenda (spec 19).
    url: call.client_id ? `/clientes/${call.client_id}` : '/agenda',
    requireInteraction: kind === 'now',
  }
}

const asCall = (doc: FirestoreDoc) => ({ id: doc.id, ...doc.data }) as unknown as Call

export async function runPushReminders({ fs, send, now, log = console.log }: PushReminderDeps): Promise<PushReminderSummary> {
  const summary: PushReminderSummary = { due: 0, sent: 0, failed: 0, removedSubscriptions: 0 }
  const docs = (await fs.runQuery(reminderQuery(now))).filter((d) => CALL_PATH.test(d.path))

  const byOwner = new Map<string, FirestoreDoc[]>()
  for (const doc of docs) {
    const owner = doc.data.owner_uid
    if (typeof owner !== 'string') continue
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), doc])
  }

  for (const [owner, ownerDocs] of byOwner) {
    try {
      const pathById = new Map(ownerDocs.map((d) => [d.id, d.path]))
      const calls = ownerDocs.map(asCall)
      const sent = new Set(calls.flatMap((c) => c.push_sent ?? []))
      const due = dueReminders(calls, owner, now, (key) => sent.has(key))
      if (due.length === 0) continue
      summary.due += due.length

      const subs = await fs.list(`users/${owner}/push_subscriptions`)
      const clients = new Map<string, Client>()
      for (const reminder of due) {
        const callPath = pathById.get(reminder.call.id)!
        const clientId = reminder.call.client_id
        if (clientId && !clients.has(clientId)) {
          const workspaceId = CALL_PATH.exec(callPath)![1]
          const client = await fs.get(`workspaces/${workspaceId}/clients/${clientId}`)
          if (client) clients.set(clientId, { id: client.id, ...client.data } as unknown as Client)
        }
        const name = getCallDisplayName(reminder.call, clients)

        let retry = false
        for (const sub of subs) {
          const data = sub.data as unknown as StoredSubscription
          if (!isAllowedPushEndpoint(data.endpoint)) {
            log(`suscripción ignorada, endpoint no permitido: ${sub.path}`)
            continue
          }
          const payload = buildPayload(reminder, name, data.timezone)
          try {
            const status = await send(data, JSON.stringify(payload), {
              // Con el navegador apagado más de esto, el aviso ya no sirve.
              ttl: reminder.kind === 'before' ? 300 : 600,
              urgency: 'high',
            })
            if (status === 404 || status === 410) {
              await fs.delete(sub.path)
              summary.removedSubscriptions++
            } else if (status >= 200 && status < 300) {
              summary.sent++
            } else {
              summary.failed++
              retry = retry || status === 429 || status >= 500
              log(`push ${status} para ${owner} (${reminder.key})`)
            }
          } catch (err) {
            summary.failed++
            retry = true
            log(`push falló para ${owner} (${reminder.key}): ${err instanceof Error ? err.message : err}`)
          }
        }
        // Un fallo pasajero se reintenta el minuto siguiente (dentro del margen
        // de gracia); quien ya lo recibió no lo ve dos veces por la `tag`.
        if (retry) continue
        // Se anota aunque no haya suscripciones: así no se vuelve a evaluar
        // cada minuto. Una llamada reagendada tiene otra clave y avisa de nuevo.
        await fs.arrayUnion(callPath, PUSH_SENT_FIELD, [reminder.key]).catch((err) => {
          log(`no se pudo anotar ${reminder.key}: ${err instanceof Error ? err.message : err}`)
        })
      }
    } catch (err) {
      log(`avisos de ${owner} fallaron: ${err instanceof Error ? err.message : err}`)
    }
  }
  return summary
}
