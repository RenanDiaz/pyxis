// Cliente REST mínimo de Firestore para el Worker (spec 21 fase 2; la spec 18
// lo reutiliza). El Worker no usa el SDK de Firebase ni firebase-admin.
// https://firebase.google.com/docs/firestore/reference/rest

/** Timestamp con la misma forma que usa la app (`toMillis`/`toDate`). */
export class RestTimestamp {
  private readonly ms: number
  constructor(ms: number) {
    this.ms = ms
  }
  toMillis(): number {
    return this.ms
  }
  toDate(): Date {
    return new Date(this.ms)
  }
}

export type RestValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values?: RestValue[] } }
  | { mapValue: { fields?: Record<string, RestValue> } }

export function decodeValue(value: RestValue): unknown {
  if ('nullValue' in value) return null
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('stringValue' in value) return value.stringValue
  if ('timestampValue' in value) return new RestTimestamp(Date.parse(value.timestampValue))
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue)
  if ('mapValue' in value) return decodeFields(value.mapValue.fields)
  return undefined // tipos que la app no usa (bytes, referencias, geopoints)
}

export function decodeFields(fields: Record<string, RestValue> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(fields ?? {})) out[key] = decodeValue(v)
  return out
}

export function encodeValue(value: unknown): RestValue {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  }
  if (typeof value === 'string') return { stringValue: value }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (value instanceof RestTimestamp) return { timestampValue: value.toDate().toISOString() }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } }
  if (typeof value === 'object') {
    const fields: Record<string, RestValue> = {}
    for (const [k, v] of Object.entries(value)) fields[k] = encodeValue(v)
    return { mapValue: { fields } }
  }
  throw new Error(`No se puede codificar ${typeof value} para Firestore`)
}

export interface FirestoreDoc {
  /** Ruta relativa a `documents/`, p. ej. `workspaces/w1/calls/c1`. */
  path: string
  id: string
  data: Record<string, unknown>
}

interface RawDoc {
  name: string
  fields?: Record<string, RestValue>
}

export interface FirestoreRestOptions {
  projectId: string
  getToken: () => Promise<string>
  /** Por defecto Google; en tests, el emulador (`http://127.0.0.1:8080/v1`). */
  baseUrl?: string
  fetcher?: typeof fetch
}

export class FirestoreRest {
  private readonly root: string
  private readonly url: string
  private readonly getToken: () => Promise<string>
  private readonly fetcher: typeof fetch

  constructor(opts: FirestoreRestOptions) {
    this.root = `projects/${opts.projectId}/databases/(default)/documents`
    this.url = `${opts.baseUrl ?? 'https://firestore.googleapis.com/v1'}/${this.root}`
    this.getToken = opts.getToken
    this.fetcher = opts.fetcher ?? fetch
  }

  private toDoc(raw: RawDoc): FirestoreDoc {
    const path = raw.name.slice(this.root.length + 1)
    return { path, id: path.slice(path.lastIndexOf('/') + 1), data: decodeFields(raw.fields) }
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const res = await this.fetcher(url, {
      ...init,
      headers: { Authorization: `Bearer ${await this.getToken()}`, 'Content-Type': 'application/json' },
    })
    if (!res.ok && res.status !== 404) {
      throw new Error(`Firestore ${init.method ?? 'GET'} ${res.status}: ${await res.text()}`)
    }
    return res
  }

  async get(path: string): Promise<FirestoreDoc | null> {
    const res = await this.request(`${this.url}/${path}`)
    if (res.status === 404) return null
    return this.toDoc((await res.json()) as RawDoc)
  }

  /** Todos los documentos de una colección (pagina hasta el final). */
  async list(collectionPath: string): Promise<FirestoreDoc[]> {
    const docs: FirestoreDoc[] = []
    let pageToken = ''
    do {
      const qs = new URLSearchParams({ pageSize: '300', ...(pageToken && { pageToken }) })
      const res = await this.request(`${this.url}/${collectionPath}?${qs}`)
      if (res.status === 404) return docs
      const data = (await res.json()) as { documents?: RawDoc[]; nextPageToken?: string }
      docs.push(...(data.documents ?? []).map((d) => this.toDoc(d)))
      pageToken = data.nextPageToken ?? ''
    } while (pageToken)
    return docs
  }

  /** `structuredQuery` del REST. `parentPath` vacío = raíz (para collection groups). */
  async runQuery(structuredQuery: Record<string, unknown>, parentPath = ''): Promise<FirestoreDoc[]> {
    const parent = parentPath ? `${this.url}/${parentPath}` : this.url
    const res = await this.request(`${parent}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery }) })
    const rows = (await res.json()) as { document?: RawDoc }[]
    return rows.flatMap((r) => (r.document ? [this.toDoc(r.document)] : []))
  }

  /** `arrayUnion` atómico; falla si el documento ya no existe. */
  async arrayUnion(path: string, field: string, values: unknown[]): Promise<void> {
    await this.request(`${this.url}:commit`, {
      method: 'POST',
      body: JSON.stringify({
        writes: [
          {
            transform: {
              document: `${this.root}/${path}`,
              fieldTransforms: [{ fieldPath: field, appendMissingElements: { values: values.map(encodeValue) } }],
            },
            currentDocument: { exists: true },
          },
        ],
      }),
    })
  }

  async delete(path: string): Promise<void> {
    await this.request(`${this.url}/${path}`, { method: 'DELETE' })
  }
}
