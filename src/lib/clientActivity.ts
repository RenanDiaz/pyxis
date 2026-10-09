import type { Client, ClientActivity } from '@/types'

// Notas del agente vs. eventos del sistema (spec 03-R6).

const SYSTEM_NOTE_PREFIX_RE = /^\[sistema\]\s?/i

export interface SplitNotes {
  /** Lo que escribe el agente: lo único editable en el textarea. */
  agentNotes: string
  /** Líneas "[SISTEMA] …" de datos viejos, tal cual (con prefijo). */
  legacySystemLines: string[]
}

/** Separa las líneas de sistema heredadas del texto del agente. */
export function splitNotes(notes: string | undefined): SplitNotes {
  const agent: string[] = []
  const legacySystemLines: string[] = []
  for (const line of (notes ?? '').split('\n')) {
    if (SYSTEM_NOTE_PREFIX_RE.test(line)) legacySystemLines.push(line)
    else agent.push(line)
  }
  return { agentNotes: agent.join('\n').trim(), legacySystemLines }
}

/**
 * Notas a guardar: el texto del agente más las líneas de sistema heredadas,
 * que se conservan hasta que el script de migración las pase a `activity`.
 */
export function joinNotes(agentNotes: string, legacySystemLines: string[]): string {
  return [agentNotes.trim(), ...legacySystemLines].filter(Boolean).join('\n\n')
}

/** Evento a partir de una línea "[SISTEMA] …" vieja. */
export function activityFromLegacyLine(line: string): ClientActivity {
  const text = line.replace(SYSTEM_NOTE_PREFIX_RE, '').trim()
  return { type: /reasignad/i.test(text) ? 'reassigned' : 'system', text, at: null, by: null }
}

/** Todos los eventos del cliente: los heredados de las notas y los nuevos. */
export function getClientActivity(client: Pick<Client, 'notes' | 'activity'>): ClientActivity[] {
  const legacy = splitNotes(client.notes).legacySystemLines.map(activityFromLegacyLine)
  return [...legacy, ...(client.activity ?? [])]
}
