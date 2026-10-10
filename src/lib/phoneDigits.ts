import type { ClientPhone } from '@/types'

// Normalización de teléfonos sin dependencias de la app: la usan también los
// scripts de `scripts/`, que corren con tsx sin los alias `@/` (solo los
// `import type` se borran al compilar y no hace falta resolverlos).

/** Colección del índice de teléfonos (spec 07). */
export const PHONE_INDEX = 'phone_index'

/** 10 dígitos de un teléfono US (sin el "1" del país); `''` si no lo es. */
export function phoneDigits(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  return digits.length === 10 ? digits : ''
}

/** Todos los teléfonos del cliente (principal y secundarios), en 10 dígitos y sin repetir. */
export function clientPhoneDigits(client: { phone?: string; phones?: ClientPhone[] }): string[] {
  const all = [client.phone ?? '', ...(client.phones ?? []).map((p) => p.number)]
  return [...new Set(all.map(phoneDigits).filter(Boolean))]
}
