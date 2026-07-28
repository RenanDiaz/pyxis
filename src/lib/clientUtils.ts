import type { Client, ClientPhone, ClientProcess, Partner } from '@/types'

/** Returns the primary phone object, or the first phone, or a fallback from legacy `phone` field. */
export function getPrimaryPhone(client: Client): ClientPhone | null {
  if (client.phones?.length) {
    return client.phones.find((p) => p.is_primary) ?? client.phones[0]
  }
  if (client.phone) {
    return { number: client.phone, label: 'personal', is_primary: true }
  }
  return null
}

/** Returns the primary phone number string, or empty string. */
export function getPrimaryPhoneNumber(client: Client): string {
  return getPrimaryPhone(client)?.number ?? ''
}

/** Returns display name, falling back to primary phone, then 'Cliente'. */
export function getClientDisplayName(client: Client): string {
  if (client.first_name || client.last_name) {
    return `${client.first_name || ''} ${client.last_name || ''}`.trim()
  }
  return getPrimaryPhoneNumber(client) || 'Cliente'
}

/** Returns all phones for display, with backward compat for legacy single phone. */
export function getAllPhones(client: Client): ClientPhone[] {
  if (client.phones?.length) return client.phones
  if (client.phone) {
    return [{ number: client.phone, label: 'personal', is_primary: true }]
  }
  return []
}

export const PHONE_LABELS: Record<string, string> = {
  personal: 'Personal',
  whatsapp: 'WhatsApp',
  trabajo: 'Trabajo',
  otro: 'Otro',
}

/**
 * Campos de texto del cliente que se almacenan siempre en mayúsculas.
 * Excluye códigos/enums (state, process, status), teléfonos e IDs.
 */
const CLIENT_UPPERCASE_FIELDS = [
  'first_name',
  'middle_name',
  'last_name',
  'llc_name',
  'ssn_itin',
  'email',
  'business_address',
  'business_purpose',
  'notes',
] as const

const PARTNER_UPPERCASE_FIELDS = ['first_name', 'last_name', 'ssn_itin', 'address'] as const

/** Campos de compañía que viven por proceso (registros de LLC). */
const PROCESS_UPPERCASE_FIELDS = ['llc_name', 'business_address', 'business_purpose'] as const

export const CLIENT_UPPERCASE_FIELD_IDS: ReadonlySet<string> = new Set(CLIENT_UPPERCASE_FIELDS)
export const PARTNER_UPPERCASE_FIELD_IDS: ReadonlySet<string> = new Set(PARTNER_UPPERCASE_FIELDS)

/** Devuelve una copia del payload con los campos de texto del cliente en mayúsculas. */
export function uppercaseClientFields<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data }
  for (const key of CLIENT_UPPERCASE_FIELDS) {
    const value = out[key]
    if (typeof value === 'string') {
      out[key] = value.toUpperCase()
    }
  }
  if (Array.isArray(out.partners)) {
    out.partners = (out.partners as Partner[]).map((partner) => {
      const next: Partner = { ...partner }
      for (const key of PARTNER_UPPERCASE_FIELDS) {
        const value = next[key]
        if (typeof value === 'string') {
          next[key] = value.toUpperCase()
        }
      }
      return next
    })
  }
  if (Array.isArray(out.processes)) {
    out.processes = (out.processes as ClientProcess[]).map((process) => {
      const next: ClientProcess = { ...process }
      for (const key of PROCESS_UPPERCASE_FIELDS) {
        const value = next[key]
        if (typeof value === 'string') {
          next[key] = value.toUpperCase()
        }
      }
      return next
    })
  }
  return out as T
}
