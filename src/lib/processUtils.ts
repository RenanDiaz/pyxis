import type { StateInfo } from '@/types'

export function getFieldValue(state: StateInfo, key: string): string {
  const parts = key.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = state
  for (const part of parts) {
    if (value == null || typeof value !== 'object') return '—'
    value = value[part as keyof typeof value]
  }
  return typeof value === 'string' ? value : '—'
}

export function formatFieldValue(
  raw: string,
  format: 'currency' | 'integer' | 'text',
): string {
  if (raw === '—') return raw
  if (format === 'text') return raw

  // Strip existing $ and commas, then parse
  const num = parseFloat(raw.replace(/[$,]/g, ''))
  if (isNaN(num)) return raw

  if (format === 'currency') {
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  // integer
  return Math.round(num).toString()
}
