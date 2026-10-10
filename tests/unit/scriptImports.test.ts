import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'

// Los scripts de `scripts/` corren con `npx tsx` sin los alias `@/` de la app.
// Lo que importen de `src/` no puede tener imports `@/` en runtime (los
// `import type` sí, porque se borran al compilar).

const RUNTIME_ALIAS = /^import\s+(?!type\b)[^;]*from\s+'@\//m

describe('imports de los scripts', () => {
  for (const script of readdirSync('scripts').filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(resolve('scripts', script), 'utf8')
    for (const [, path] of source.matchAll(/from '(\.\.\/src\/[^']+)'/g)) {
      it(`${script} → ${path} no usa alias @/ en runtime`, () => {
        const file = readFileSync(resolve('scripts', `${path}.ts`), 'utf8')
        assert.doesNotMatch(file, RUNTIME_ALIAS)
      })
    }
  }
})
