import type { StateInfo } from '@/types'
import { STATE_NAMES_ES } from './stateNamesEs'

/**
 * Extract digits from a string (strips formatting like +, -, (, ), spaces)
 */
function extractDigits(input: string): string {
  return input.replace(/\D/g, '')
}

/**
 * Try to extract a US area code from a search query.
 * Handles formats like: (212), 212, +1 212 555 1234, 12125551234, 2125551234, etc.
 */
function extractAreaCode(query: string): string | null {
  const digits = extractDigits(query)
  if (digits.length < 3) return null

  // If it looks like a phone number (7+ digits), extract area code
  if (digits.length >= 7) {
    // With country code: 1XXXXXXXXXX (11 digits)
    if (digits.length === 11 && digits[0] === '1') {
      return digits.slice(1, 4)
    }
    // Without country code: XXXXXXXXXX (10 digits)
    if (digits.length === 10) {
      return digits.slice(0, 3)
    }
    // Partial numbers: try first 3 digits (after removing leading 1 if present)
    if (digits.length > 10 && digits[0] === '1') {
      return digits.slice(1, 4)
    }
    return digits.slice(0, 3)
  }

  // 3-digit input could be an area code directly
  if (digits.length === 3) {
    return digits
  }

  return null
}

/**
 * Check if a ZIP code falls within a state's zip_code_range.
 * Ranges are comma-separated like "350-369" or "100-149, 005-009".
 */
function matchesZipRange(zipCode: string, zipRange: string): boolean {
  if (!zipRange) return false

  const zip = parseInt(zipCode, 10)
  if (isNaN(zip)) return false

  // Get the 3-digit prefix for matching
  const zipPrefix = zipCode.length >= 5
    ? parseInt(zipCode.slice(0, 3), 10)
    : zip

  const ranges = zipRange.split(',').map(r => r.trim())
  for (const range of ranges) {
    const parts = range.split('-').map(p => parseInt(p.trim(), 10))
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (zipPrefix >= parts[0] && zipPrefix <= parts[1]) return true
    } else if (parts.length === 1 && !isNaN(parts[0])) {
      if (zipPrefix === parts[0]) return true
    }
  }
  return false
}

/**
 * Enhanced state filter that searches by:
 * - State name (English)
 * - State name (Spanish)
 * - Abbreviation
 * - ZIP code
 * - Area code
 * - Phone number (extracts area code)
 */
export function filterStates(states: StateInfo[], query: string): StateInfo[] {
  const q = query.trim()
  if (!q) return states

  const lower = q.toLowerCase()
  const digits = extractDigits(q)
  const areaCode = extractAreaCode(q)

  return states.filter((s) => {
    // Name match (English)
    if (s.name.toLowerCase().includes(lower)) return true

    // Abbreviation match
    if (s.abbreviation.toLowerCase().includes(lower)) return true

    // Name match (Spanish)
    const spanishName = STATE_NAMES_ES[s.name]
    if (spanishName && spanishName.toLowerCase().includes(lower)) return true

    // Only check numeric matches if there are digits in the query
    if (digits.length >= 3) {
      // Area code match (direct or extracted from phone number)
      if (areaCode && s.area_codes?.includes(areaCode)) return true

      // ZIP code match
      if (digits.length >= 3 && digits.length <= 5) {
        if (matchesZipRange(digits, s.zip_code_range)) return true
      }
    }

    return false
  })
}
