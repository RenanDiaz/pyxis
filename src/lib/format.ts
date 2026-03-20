/**
 * Normalizes price strings from states.json.
 * Handles: "$579", "699.0", "125", "$125.00"
 */
export function formatPrice(value: string): string {
  if (!value || value === 'N/A') return 'N/A'
  const cleaned = value.replace(/[$,]/g, '')
  const num = parseFloat(cleaned)
  if (isNaN(num)) return value
  return `$${Math.round(num)}`
}

/**
 * Normalizes processing days strings.
 * Handles: "7", "7.0", "30.0"
 */
export function formatDays(value: string): string {
  if (!value || value === 'N/A') return 'N/A'
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return `${Math.round(num)}`
}

/**
 * Formats YES/NO or SI/NO for display.
 */
export function formatYesNo(value: string): { label: string; positive: boolean } {
  const upper = value.toUpperCase()
  if (upper === 'YES' || upper === 'SI' || upper === 'SÍ') {
    return { label: 'Sí', positive: true }
  }
  return { label: 'No', positive: false }
}
