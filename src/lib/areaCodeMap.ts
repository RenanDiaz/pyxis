import statesData from '@/data/states.json'
import type { StateInfo } from '@/types'

const areaCodeToState = new Map<string, string>()

for (const state of statesData as StateInfo[]) {
  for (const code of state.area_codes) {
    areaCodeToState.set(code, state.abbreviation)
  }
}

/**
 * Extracts the area code from a phone number and returns the matching state abbreviation.
 * Handles raw digits, formatted numbers, and optional country code "1".
 */
export function getStateByAreaCode(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')

  let areaCode: string
  if (digits.length >= 11 && digits.startsWith('1')) {
    areaCode = digits.slice(1, 4)
  } else if (digits.length >= 3) {
    areaCode = digits.slice(0, 3)
  } else {
    return null
  }

  return areaCodeToState.get(areaCode) ?? null
}
