import type { Client, ClientPhone } from '@/types'

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
