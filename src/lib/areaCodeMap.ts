import statesData from '@/data/states.json'
import type { StateInfo } from '@/types'

// Mapa por lista de estados: los códigos de área se editan desde la app
// (StateEditDialog), así que se usa la lista de Firestore cuando se pasa y
// `states.json` como respaldo (spec 13).
const mapsByList = new WeakMap<readonly StateInfo[], Map<string, string>>()
const localStates = statesData as StateInfo[]

function areaCodeMapFor(states: readonly StateInfo[]): Map<string, string> {
  let map = mapsByList.get(states)
  if (!map) {
    map = new Map()
    for (const state of states) {
      for (const code of state.area_codes ?? []) map.set(code, state.abbreviation)
    }
    mapsByList.set(states, map)
  }
  return map
}

/** Código de área (3 dígitos) de un teléfono US, con o sin el "1" del país. */
export function getAreaCode(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 11 && digits.startsWith('1')) return digits.slice(1, 4)
  if (digits.length >= 3) return digits.slice(0, 3)
  return null
}

/**
 * Extracts the area code from a phone number and returns the matching state abbreviation.
 * Handles raw digits, formatted numbers, and optional country code "1".
 */
export function getStateByAreaCode(phone: string, states: readonly StateInfo[] = localStates): string | null {
  const areaCode = getAreaCode(phone)
  if (!areaCode) return null
  return areaCodeMapFor(states.length ? states : localStates).get(areaCode) ?? null
}
