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
 * Formatea un monto para mostrar. Si el valor no tiene decimales, se muestra
 * sin ellos (p. ej. `350`); si los tiene, se fija a 2 cifras (p. ej. `350.50`).
 * No incluye el símbolo `$` — agregarlo en el sitio de uso.
 */
export function formatMoney(value: number): string {
  const hasDecimals = Math.round(value * 100) % 100 !== 0
  return value.toLocaleString('en-US', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })
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
