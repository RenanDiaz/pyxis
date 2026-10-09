# 14 — Aviso de nueva versión

**Prioridad:** 🟠 Alta · **Estado:** implementado

## Problema
Pyxis es una SPA: una pestaña abierta sigue corriendo el JS con el que se
cargó hasta que el usuario recarga. Los agentes la dejan abierta todo el día.
- **Código viejo escribiendo datos:** después de un deploy que cambia cómo se
  guardan los datos (p. ej. pagos transaccionales, PR #95, o historial de
  status, PR #96), las pestañas viejas siguen escribiendo con la lógica anterior.
- **Chunks que ya no existen:** los chunks cargados bajo demanda (hoy `exceljs`;
  más con el code splitting del spec 10) tienen hash. Tras un deploy el archivo
  viejo no existe, y `vercel.json` reescribía todo a `index.html`, así que el
  navegador recibía HTML en vez de JS ⇒ "Failed to fetch dynamically imported
  module" al exportar.
- **Nadie se entera:** no hay forma de saber que hay una versión nueva.

## Objetivo
Que el usuario sepa que hay una versión nueva y pueda recargar en un clic, sin
perder lo que está escribiendo.

## Requisitos
1. **Versión por build:** cada build tiene un identificador de versión.
   - Se usa `VERCEL_GIT_COMMIT_SHA` y, fuera de Vercel, la hora del build.
   - Se compila en la app (`__APP_VERSION__`) y se publica en `/version.json`.
2. **Chequeo:** la app consulta `/version.json` sin caché.
   - Cada 5 minutos.
   - Al volver la pestaña a primer plano (`visibilitychange`, `focus`).
   - Solo en builds de producción.
3. **Aviso:** si la versión publicada es distinta, se muestra un aviso fijo
   "Hay una nueva versión de Pyxis" con los botones **Recargar** y **Más tarde**.
   - **No recarga solo:** el agente puede estar en una llamada.
   - **"Más tarde":** oculta el aviso hasta que aparezca otra versión o pase 1 hora.
   - **Recargar es seguro:** los formularios tienen borrador
     ([form-drafts](form-drafts.md)), así que no se pierde lo escrito.
4. **Chunk faltante:** si falla la carga de un chunk (`vite:preloadError`), se
   muestra el mismo aviso. Así el usuario entiende qué pasó y cómo resolverlo.
5. **`vercel.json`:**
   - `/assets/*` ya no se reescribe a `index.html`: un chunk faltante da 404 en vez de HTML.
   - `/version.json` se sirve con `Cache-Control: no-store`.

## Fuera de alcance
- **Service worker / PWA:** agrega una capa de caché que complica justo este
  problema, y no hace falta uso sin conexión.
- **Recarga forzada por "versión mínima" en Firestore:** para deploys que
  rompan compatibilidad de datos. Queda como mejora si crece el número de usuarios.

## Diseño
- `vite.config.ts`:
  - `define: { __APP_VERSION__ }`.
  - Plugin `appVersion` que emite `version.json` en el build.
- `src/lib/appVersion.ts`: `APP_VERSION`, `fetchDeployedVersion()` e
  `isOutdated(current, deployed)` (pura, con tests).
- `src/hooks/useNewVersionAvailable.ts`: polling, listeners de visibilidad y
  foco, `vite:preloadError`, y el estado de "Más tarde".
- `src/components/layout/UpdateBanner.tsx`: el aviso, montado en `App`, así que
  también se ve en Login y Onboarding.

## Criterios de aceptación
- [x] Build de producción: `dist/version.json` contiene la misma versión compilada en la app.
- [x] Con la app abierta, cambiar `version.json` y volver a la pestaña muestra el aviso.
- [x] "Recargar" carga la versión nueva; "Más tarde" lo oculta.
- [x] En `npm run dev` no se consulta nada.
- [x] Un chunk faltante devuelve 404 (no HTML) con la config de Vercel. *(verificado leyendo la config; se confirma en el preview)*
