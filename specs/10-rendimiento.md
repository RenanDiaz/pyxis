# 10 — Rendimiento

**Prioridad:** 🟡 Media · **Estado:** implementado (chunk inicial 259 KB, ver Decisiones)

## Problema
- ✔ Sin code splitting: `App.tsx` importa todas las páginas en estático y
  `vite.config.ts` no tiene `manualChunks`. Chunk principal **2.06 MB (631 KB gzip)**
  (medido con `vite build`). `docx` y `jspdf`+`html2canvas` entran estáticos vía
  `ClientDetail`, `ProcessCard`, `PaymentSection`; también `react-simple-maps` + `us-atlas`.
  Solo `exceljs` está separado. Pesado para agentes en móvil.
- ✔ `Clients.tsx`: `search` forma parte del queryKey de `useClients` ⇒ **cada tecla dispara un `getDocs` de toda la colección** (el filtro es en memoria). Lecturas y latencia. Sin paginación.
- `StateDetail`: `useNow(1000)` re-renderiza la página completa cada segundo (incluido el sort de 50 estados); un `StateClock` por `ProcessCard`.
- Notificaciones de llamadas no se refrescan solas (sin `refetchInterval`, `staleTime` 5 min).

## Implementación (2026-10-09)
- **Rutas lazy** (`App.tsx`): `React.lazy` por página. El `Suspense` de
  `AppLayout` envuelve solo el `<Outlet />`, así que sidebar y header no
  parpadean al navegar; el fallback es `PageLoader`.
- **Chunk que ya no existe tras un deploy:** `RouteErrorBoundary` lo detecta y
  muestra "Hay una nueva versión de Pyxis · Recargar" en vez del error genérico
  (además del banner de spec 14).
- **Exportes en el clic:** `exportClientDoc` (docx) y `receiptUtils` (jsPDF) se
  importan dinámicamente en `ClientDetail`, `ProcessCard` y `PaymentSection`.
  La subida del logo pasó a `workspaceLogo.ts` para que Configuración no cargue
  jsPDF.
- **Firebase Storage fuera del bundle inicial:** `src/lib/firebaseStorage.ts`
  (solo lo cargan documentos y logo).
- **Vendors** (`vite.config.ts`, `codeSplitting.groups` de rolldown):
  `firebase` (sin Storage), `react`, `map`. Cambian poco entre deploys y quedan
  en caché del navegador.
- **Búsqueda de clientes:** `search` salió del queryKey y de `getClients`. Se
  filtra en memoria con `filterClientsBySearch` (`src/lib/clientSearch.ts`,
  con tests) tras un debounce de 250 ms (`useDebouncedValue`). De paso: ignora
  acentos ("maria" encuentra "MARÍA") y compara teléfonos por dígitos
  (`305-555-1234` encuentra `+1 (305) 555-1234`, también secundarios).
- **StateDetail:** el reloj y el semáforo son componentes hoja (`LocalTime`,
  `CallTimeBadge`); la lista de estados del selector está memoizada.
  `StateClock` ya era hoja, no se tocó.
- **Campana/inicio:** `useUpcomingCalls` y `useOverdueCalls` con
  `refetchInterval: 60_000` y `refetchOnWindowFocus: 'always'`.

### Resultado (gzip)
| | Antes | Después |
|---|---|---|
| JS al abrir la app | 644 KB (un chunk) | 259 KB (firebase 106 · react 71 · app 34 · resto) |
| `/clientes/:id` | todo incluido | sin docx ni jsPDF hasta exportar |

### Decisiones
- **Meta de 250 KB no alcanzada (259 KB):** lo que queda es Firestore + Auth
  (106 KB) y React (71 KB). Bajarlo exige cambiar a `firebase/firestore/lite`
  (sin caché offline ni listeners), que no vale el riesgo por 9 KB. Como son
  chunks de vendor separados, tras un deploy solo se re-descarga el código de la
  app.
- **P1 (volumen):** un solo workspace con pocos clientes ⇒ filtrado en memoria
  basta. Paginación/búsqueda server-side quedan para cuando pase de ~500.
- El filtro por status sigue en Firestore (cambia poco y reduce lecturas).

## Requisitos
1. `React.lazy` + `Suspense` por ruta en `App.tsx` (fallback con skeleton).
2. `import()` dinámico de `exportClientDoc` y `receiptUtils` en el clic (como ya se hace con `generateSalesReport`).
3. `manualChunks`: `firebase`, `react` vendor, mapa.
4. Búsqueda de clientes: debounce 250 ms y filtrado en memoria sobre la query cacheada (sin `search` en el queryKey). Paginación/virtualización si > 500 clientes (ver P1).
5. `StateDetail`: aislar el reloj en un componente hoja; memoizar listas.
6. `useOverdueCalls`/`useUpcomingCalls` con `refetchInterval: 60_000` y `refetchOnWindowFocus`.

## Criterios de aceptación
- [ ] Chunk inicial < 250 KB gzip. *(259 KB, ver Decisiones)*
- [x] Abrir `/clientes/:id` no descarga `docx` ni `jspdf` hasta exportar.
- [x] Escribir "maria" en la búsqueda produce 0 lecturas nuevas de Firestore.
- [x] Una llamada que vence mientras la app está abierta aparece en la campana en ≤ 1 min.

## Preguntas abiertas
- **P1:** ¿Cuántos clientes tiene hoy el workspace más grande? Define si basta con filtrado en memoria o hace falta búsqueda server-side (p. ej. campo `search_tokens`).
