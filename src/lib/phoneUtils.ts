/**
 * Strips a phone string down to digits only.
 */
function stripPhone(phone: string): string {
  return phone.replace(/[\s\-()+=]/g, '')
}

/**
 * Returns digits-only phone with US country code (1) prepended if missing.
 * Suitable for WhatsApp links: https://wa.me/{result}
 */
export function formatPhoneForWhatsApp(phone: string): string {
  const digits = stripPhone(phone).replace(/\D/g, '')
  if (digits.length === 0) return ''
  // Already has country code (11+ digits starting with 1)
  if (digits.length >= 11 && digits.startsWith('1')) return digits
  // 10-digit US number — prepend 1
  if (digits.length === 10) return `1${digits}`
  return digits
}

/**
 * Formats a phone for display: +1 (786) 555-1234
 * Falls back to the raw string if it can't be parsed as US number.
 */
export function formatPhoneForDisplay(phone: string): string {
  const digits = stripPhone(phone).replace(/\D/g, '')
  // Normalize to 10-digit local number
  let local = digits
  if (local.length === 11 && local.startsWith('1')) local = local.slice(1)
  if (local.length === 10) {
    return `+1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
  }
  return phone // return original if not a standard US number
}

/**
 * Returns true if the phone has at least 10 digits after cleanup.
 */
export function isValidPhone(phone: string): boolean {
  const digits = stripPhone(phone).replace(/\D/g, '')
  return digits.length >= 10
}
