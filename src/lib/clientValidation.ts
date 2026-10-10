import type { Partner } from '@/types'

// Validaciones del formulario de cliente (spec 13). Puras, para probarlas.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

/**
 * SSN o ITIN: 9 dígitos (con o sin guiones). Devuelve el error o `null`.
 * - ITIN: empieza con 9.
 * - SSN: no empieza con 000, 666 ni 9; grupo ≠ 00; serie ≠ 0000.
 */
export function taxIdError(value: string): string | null {
  const digits = value.replace(/[\s-]/g, '')
  if (!digits) return null
  if (!/^\d{9}$/.test(digits)) return 'debe tener 9 dígitos (ej. 123-45-6789)'
  if (digits.startsWith('9')) return null // ITIN
  const area = digits.slice(0, 3)
  if (area === '000' || area === '666') return 'no es un SSN válido'
  if (digits.slice(3, 5) === '00' || digits.slice(5) === '0000') return 'no es un SSN válido'
  return null
}

/**
 * Advertencia (no bloqueo) si los porcentajes de los socios no suman 100.
 * Sin porcentajes cargados no hay nada que advertir.
 */
export function ownershipWarning(partners: Partner[]): string | null {
  const withPct = partners.filter((p) => (p.ownership_percentage ?? 0) > 0)
  if (withPct.length === 0) return null
  const total = withPct.reduce((sum, p) => sum + (p.ownership_percentage ?? 0), 0)
  if (Math.abs(total - 100) < 0.01) return null
  return `Los porcentajes de los socios suman ${Number(total.toFixed(2))}%, no 100%.`
}
