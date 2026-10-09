# 09 — Manejo de errores y sesión

**Prioridad:** 🟡 Media · **Estado:** implementado (ver abajo)

## Problema
- Casi ningún `mutateAsync` tiene try/catch (`ClientDetail`: status, archivar, borrar, procesos; `Schedule`; `WorkspaceMembers`; `WorkspaceSubteams`; `GoalModal`). Si falla, no hay toast y **el agente cree que se guardó**.
- No hay ErrorBoundary: ✔ en `Reports.tsx`, vaciar el `<input type="month">` produce `Invalid Date` y `format()` lanza `RangeError` ⇒ la página se cae entera. Además el mes se formatea sin `locale: es` (sale en inglés en UI y Excel).
- ✔ `AuthContext`: si `ensureUserProfile` lanza (red/reglas), `setLoading(false)` nunca corre ⇒ "Cargando…" infinito.
- ✔ `signOut` no hace `queryClient.clear()`; varias query keys no incluyen uid ⇒ otro usuario en el mismo navegador puede ver datos cacheados del anterior.
- Sin estados `isError` en listas (Clients, Home, Schedule, StateDetail): un error se ve como "No hay clientes aún".
- Login muestra `err.message` de Firebase en inglés; no hay "¿Olvidaste tu contraseña?".
- `JoinWorkspace`: `getWorkspace(...).then` sin `catch`.

## Implementación (2026-10-09)
- **R1:** `src/lib/queryClient.ts` tiene un `MutationCache.onError` que muestra un toast en español.
  - Cada hook declara su mensaje en `meta.errorMessage` (p. ej. "No se pudo agendar la llamada"); `meta.silent` lo desactiva.
  - Se quitaron los `toast.error` locales que lo duplicaban. Las operaciones que no son mutaciones (subir archivos, logo, crear workspace) usan `describeError` en su propio catch.
- **Mensajes (`src/lib/errors.ts`):** `describeError` arma el mensaje en este orden de prioridad:
  1. `UserFacingError`: errores propios con texto pensado para el usuario.
  2. El código de Firebase traducido (Firestore, Storage, Auth).
  3. El mensaje de la acción.
  Nunca muestra un error técnico crudo.
- **R2:** las lecturas no muestran toast (un refetch en segundo plano no debe interrumpir). `ErrorState` con "Reintentar" en Clientes, Agenda e Inicio.
- **R3:** `RouteErrorBoundary` en `AppLayout`, con `key` = ruta: navegar a otra página lo reinicia.
- **R4:** `AuthContext` envuelve `ensureUserProfile` en try/catch/finally. Si falla, `PrivateRoute` muestra "No se pudo cargar tu perfil" con Reintentar y Cerrar sesión.
- **R5:** `queryClient.clear()` al cerrar sesión y cuando cambia el uid.
- **R6 y R7:** errores de Auth en español y "¿Olvidaste tu contraseña?". El mensaje es el mismo exista o no la cuenta.
- **R8:** el mes vacío se ignora. La UI muestra el mes en español; **el Excel se queda en inglés** a propósito (nombre de hoja y archivo "October 2026 Sales Report", del formato original).
- **R9:** "Ningún cliente coincide con los filtros", con el botón "Limpiar filtros".
- **Tests:** 3 unitarios de `describeError`.
- **Probado en el navegador (sin Firebase):**
  - toast global al fallar crear un cliente;
  - borrar el mes en Reportes no rompe la página;
  - recuperar contraseña sin correo;
  - fallback del ErrorBoundary, que se reinicia al navegar.

## Requisitos
1. `QueryClient` con `mutationCache: new MutationCache({ onError })` que muestra
   un toast en español por defecto; las mutaciones pueden optar por manejo propio (`meta: { silent: true }`).
2. `queryCache.onError` para loguear; componentes muestran estado de error con "Reintentar".
3. ErrorBoundary por ruta (dentro de `AppLayout`) con mensaje en español y botón "Volver al inicio".
4. `AuthContext`: try/catch/finally alrededor de `ensureUserProfile`; si falla, pantalla de error con reintentar.
5. `signOut`: `queryClient.clear()` (además de borrar borradores, ya implementado).
6. Mapa de códigos de Firebase Auth → mensajes en español (`auth/invalid-credential`, `auth/too-many-requests`, `auth/email-already-in-use`, `auth/weak-password`, `auth/popup-closed-by-user`, …).
7. "¿Olvidaste tu contraseña?" con `sendPasswordResetEmail`.
8. Reportes: no permitir mes vacío; formatear con `locale: es`.
9. Estados vacíos distintos: "No hay clientes aún" vs "Ningún cliente coincide con los filtros".

## Criterios de aceptación
- [ ] Con la red cortada, cambiar el status de un cliente muestra un toast de error.
- [ ] Vaciar el campo de mes en Reportes no rompe la página.
- [ ] Cerrar sesión y entrar con otro usuario no muestra datos del anterior ni por un instante.
- [ ] Contraseña incorrecta muestra "Correo o contraseña incorrectos".
- [ ] Un error de render en una página muestra el fallback, no pantalla en blanco.
