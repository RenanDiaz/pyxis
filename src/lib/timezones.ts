export const STATE_TIMEZONE_MAP: Record<string, string> = {
  // Eastern
  CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York',
  FL: 'America/New_York', GA: 'America/New_York', IN: 'America/New_York',
  KY: 'America/New_York', ME: 'America/New_York', MD: 'America/New_York',
  MA: 'America/New_York', MI: 'America/New_York', NH: 'America/New_York',
  NJ: 'America/New_York', NY: 'America/New_York', NC: 'America/New_York',
  OH: 'America/New_York', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', TN: 'America/New_York', VT: 'America/New_York',
  VA: 'America/New_York', WV: 'America/New_York',
  // Central
  AL: 'America/Chicago', AR: 'America/Chicago', IL: 'America/Chicago',
  IA: 'America/Chicago', KS: 'America/Chicago', LA: 'America/Chicago',
  MN: 'America/Chicago', MS: 'America/Chicago', MO: 'America/Chicago',
  NE: 'America/Chicago', ND: 'America/Chicago', OK: 'America/Chicago',
  SD: 'America/Chicago', TX: 'America/Chicago', WI: 'America/Chicago',
  // Mountain
  CO: 'America/Denver', ID: 'America/Denver', MT: 'America/Denver',
  NM: 'America/Denver', UT: 'America/Denver', WY: 'America/Denver',
  // Arizona (no DST)
  AZ: 'America/Phoenix',
  // Pacific
  CA: 'America/Los_Angeles', NV: 'America/Los_Angeles',
  OR: 'America/Los_Angeles', WA: 'America/Los_Angeles',
  // Alaska
  AK: 'America/Anchorage',
  // Hawaii
  HI: 'Pacific/Honolulu',
}

const TIMEZONE_LABELS: Record<string, string> = {
  'America/New_York': 'Eastern',
  'America/Chicago': 'Central',
  'America/Denver': 'Mountain',
  'America/Phoenix': 'Arizona',
  'America/Los_Angeles': 'Pacific',
  'America/Anchorage': 'Alaska',
  'Pacific/Honolulu': 'Hawái',
}

export function getStateTimezone(abbreviation: string): string {
  return STATE_TIMEZONE_MAP[abbreviation] ?? 'America/New_York'
}

export function getTimezoneLabel(timezone: string): string {
  return TIMEZONE_LABELS[timezone] ?? timezone
}

/**
 * Estados con más de una zona horaria (spec 13). Para ellos la zona del
 * estado es la mayoritaria y puede errar por una hora.
 */
const MULTI_ZONE_STATES = new Set(['TX', 'FL', 'TN', 'KY', 'IN', 'MI', 'ND', 'SD', 'NE', 'KS', 'OR', 'ID'])

/**
 * Por estado, códigos de área que caen enteros (o casi) en una sola zona. Los que mezclan zonas (850 FL, 812 IN, 906 MI, 208 ID…) no se
 * listan: ahí la zona queda "por confirmar".
 */
const AREA_CODE_TIMEZONE: Record<string, Record<string, string>> = {
  // El Paso
  TX: { '915': 'America/Denver' },
  // Nashville, Memphis y el oeste/centro son Central; el este (Knoxville,
  // Chattanooga) es Eastern
  TN: {
    '615': 'America/Chicago', '629': 'America/Chicago', '731': 'America/Chicago',
    '901': 'America/Chicago', '931': 'America/Chicago',
    '423': 'America/New_York', '865': 'America/New_York',
  },
  // El oeste
  KY: { '270': 'America/Chicago', '364': 'America/Chicago' },
  // Noroeste (Gary)
  IN: { '219': 'America/Chicago' },
}

export function isMultiZoneState(abbreviation: string): boolean {
  return MULTI_ZONE_STATES.has(abbreviation)
}

export interface ClientTimezone {
  timezone: string
  /** `false`: estado con varias zonas y el teléfono no la resuelve. */
  certain: boolean
}

/**
 * Zona horaria del cliente: la de su código de área si cae entera en una
 * zona de su estado, si no la del estado (spec 13).
 */
export function getClientTimezone(state: string, phone?: string | null): ClientTimezone {
  const stateTz = getStateTimezone(state)
  if (!isMultiZoneState(state)) return { timezone: stateTz, certain: true }
  const digits = (phone ?? '').replace(/\D/g, '')
  const areaCode = digits.length >= 11 && digits.startsWith('1') ? digits.slice(1, 4) : digits.slice(0, 3)
  // Solo si el código es de ese mismo estado: un cliente que se mudó conserva
  // su número viejo.
  const byArea = AREA_CODE_TIMEZONE[state]?.[areaCode]
  return byArea ? { timezone: byArea, certain: true } : { timezone: stateTz, certain: false }
}
