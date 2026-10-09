import type { Client } from '@/types'

/** Minúsculas y sin acentos: "MARÍA" y "maria" son lo mismo al buscar. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

const digitsOnly = (value: string) => value.replace(/\D/g, '')

/**
 * Filtro de la búsqueda de clientes, en memoria sobre la lista ya cargada
 * (spec 10): escribir no dispara lecturas de Firestore. Busca por nombre,
 * LLC, estado y teléfonos; los teléfonos se comparan solo por dígitos, así
 * que `3055551234` encuentra `+1 (305) 555-1234`.
 */
export function filterClientsBySearch(clients: Client[], search: string): Client[] {
  const text = normalizeSearchText(search)
  if (!text) return clients
  const digits = digitsOnly(search)
  const searchPhones = digits.length >= 3

  return clients.filter((c) => {
    const fields = [
      c.first_name,
      c.last_name,
      `${c.first_name ?? ''} ${c.last_name ?? ''}`,
      c.llc_name,
      c.state,
    ]
    if (fields.some((f) => f && normalizeSearchText(f).includes(text))) return true
    if (!searchPhones) return false
    const phones = [c.phone, ...(c.phones ?? []).map((p) => p.number)]
    return phones.some((p) => p && digitsOnly(p).includes(digits))
  })
}
