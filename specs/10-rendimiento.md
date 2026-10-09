# 10 — Rendimiento

**Prioridad:** 🟡 Media · **Estado:** propuesto

## Problema
- ✔ Sin code splitting: `App.tsx` importa todas las páginas en estático y
  `vite.config.ts` no tiene `manualChunks`. Chunk principal **2.06 MB (631 KB gzip)**
  (medido con `vite build`). `docx` y `jspdf`+`html2canvas` entran estáticos vía
  `ClientDetail`, `ProcessCard`, `PaymentSection`; también `react-simple-maps` + `us-atlas`.
  Solo `exceljs` está separado. Pesado para agentes en móvil.
- ✔ `Clients.tsx`: `search` forma parte del queryKey de `useClients` ⇒ **cada tecla dispara un `getDocs` de toda la colección** (el filtro es en memoria). Lecturas y latencia. Sin paginación.
- `StateDetail`: `useNow(1000)` re-renderiza la página completa cada segundo (incluido el sort de 50 estados); un `StateClock` por `ProcessCard`.
- Notificaciones de llamadas no se refrescan solas (sin `refetchInterval`, `staleTime` 5 min).

## Requisitos
1. `React.lazy` + `Suspense` por ruta en `App.tsx` (fallback con skeleton).
2. `import()` dinámico de `exportClientDoc` y `receiptUtils` en el clic (como ya se hace con `generateSalesReport`).
3. `manualChunks`: `firebase`, `react` vendor, mapa.
4. Búsqueda de clientes: debounce 250 ms y filtrado en memoria sobre la query cacheada (sin `search` en el queryKey). Paginación/virtualización si > 500 clientes (ver P1).
5. `StateDetail`: aislar el reloj en un componente hoja; memoizar listas.
6. `useOverdueCalls`/`useUpcomingCalls` con `refetchInterval: 60_000` y `refetchOnWindowFocus`.

## Criterios de aceptación
- [ ] Chunk inicial < 250 KB gzip.
- [ ] Abrir `/clientes/:id` no descarga `docx` ni `jspdf` hasta exportar.
- [ ] Escribir "maria" en la búsqueda produce 0 lecturas nuevas de Firestore.
- [ ] Una llamada que vence mientras la app está abierta aparece en la campana en ≤ 1 min.

## Preguntas abiertas
- **P1:** ¿Cuántos clientes tiene hoy el workspace más grande? Define si basta con filtrado en memoria o hace falta búsqueda server-side (p. ej. campo `search_tokens`).
