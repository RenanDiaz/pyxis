# 27 — Búsqueda global (Ctrl/⌘+K)

**Prioridad:** 🔴 Alta (mayor impacto en llamada; confirmado por la analítica) · **Estado:** pendiente · **Tamaño:** M · **Depende de:** [25](25-consistencia-visual.md) · **Relacionado:** [24](24-analytics-uso.md), [26](26-navegacion.md), [29](29-ficha-estado-panel.md)

## Problema
Durante una llamada el agente necesita llegar en segundos a un cliente, a un
estado o a la traducción de un término. Hoy cada cosa se busca dentro de su
módulo: hay que navegar al módulo, encontrar su buscador y escribir. No existe
ningún atajo de teclado en la app y el `Header` está vacío salvo campana, tema
y avatar.

## Datos de uso
Según la analítica del 2026-11-10 (30 días, 1 agente y 1 owner activos; ver `README.md`): `state_search` es el evento más
frecuente de toda la app (**159**, contra 15 búsquedas de clientes), con 94
fichas abiertas de **40 estados distintos**. El agente va y viene entre Estados
y Clientes todo el día. Oficios y Glosario no se buscaron ni se abrieron.
Móvil es el 3 % de las vistas.

Consecuencias: los estados van primero en los resultados, la versión de
escritorio con teclado es la que importa, y Oficios/Glosario quedan como
fuentes secundarias (ver pregunta 4).

## Objetivo
Un solo buscador, disponible desde cualquier pantalla, que encuentre clientes,
estados, oficios y términos del glosario, y ejecute las acciones más comunes.

## Diagnóstico (verificado en el código, 2026-11-10)
- Los datos ya están en caché de React Query: `useClients()` (filtrado por rol),
  `useStates()`, `useTrades()`, `useGlossary()`.
- Los filtros ya existen y están probados: `filterClientsBySearch`
  (`lib/clientSearch.ts`: nombre, teléfono, LLC, estado; ignora acentos) y
  `filterStates` (`lib/stateSearch.ts`).
- `Trades` y `Glossary` filtran en memoria con `useState` local; sus términos
  no tienen página de detalle.
- No hay `cmdk` ni componente `command` de shadcn instalado.

## Requisitos
### Apertura
1. `Ctrl+K` (Windows/Linux) y `⌘+K` (macOS) abren y cierran el buscador desde
   cualquier ruta de `AppLayout`. `Esc` cierra.
2. En desktop, el `Header` muestra un campo falso "Buscar… ⌘K" (botón) a la
   izquierda. En móvil, un ícono de lupa en el `Header` abre el buscador a
   pantalla completa.
3. El atajo no se dispara mientras hay otro diálogo modal abierto.

### Resultados
4. Grupos, en este orden, con máximo 5 resultados cada uno:

   | Grupo | Fuente | Fila muestra | Al elegir |
   |---|---|---|---|
   | Estados | `useStates()` + `filterStates` | nombre, abreviatura, precio, hora local | `/estados/:abbreviation` |
   | Clientes | `useClients()` + `filterClientsBySearch` | nombre, LLC, teléfono, `StatusBadge` | `/clientes/:id` |
   | Oficios | `useTrades()` | nombre EN → ES, categoría | ver req. 6 |
   | Glosario | `useGlossary()` | término, traducción, definición (1 línea) | ver req. 6 |
   | Acciones | lista fija | etiqueta + ícono | ejecuta |

   Una abreviatura exacta de estado ("tx", "FL") es siempre el primer
   resultado y queda seleccionada: `⌘K`, `tx`, `Enter` abre Texas.
5. **Acciones** (con texto vacío se muestran estas y los "recientes"):
   Nuevo cliente (`/clientes/nuevo`), Agendar llamada (`/agenda` con el modal
   abierto), Ir a Inicio / Clientes / Agenda / Estados / Reportes.
   Hoy `Schedule` solo abre el modal con `?client=…` o `?lead_*=…`: agregar un
   parámetro `?nueva=1` que lo abra vacío y se limpie de la URL al abrir.
6. **Oficios y Glosario se responden en el buscador:** la traducción y la
   definición se leen en la propia fila (o en un panel de vista previa al
   resaltarla). `Enter` navega a `/oficios` o `/glosario` con el buscador de la
   página prellenado vía `location.state` (**no** por query string).
7. **Recientes:** con el texto vacío, los últimos 5 clientes y estados abiertos
   desde el buscador. Se guardan en `localStorage` **solo como ids/abreviaturas**
   (nunca nombres), por `uid`, y se borran al cerrar sesión.
8. Mismo alcance por rol que el resto de la app: un `agent` solo encuentra sus
   clientes (lo garantiza `useClients()`; el buscador no hace queries propias).
9. Los clientes archivados no aparecen (ver pregunta 2).
10. Búsqueda en memoria, sin lecturas a Firestore al escribir. Si la lista de
    clientes aún no cargó, el grupo muestra un skeleton; estados, oficios y
    glosario responden igual.
11. Sin resultados: "Nada coincide con «…»" + acción "Crear cliente nuevo".

### Teclado y accesibilidad
12. `↑/↓` mueven la selección entre grupos, `Enter` elige, foco atrapado en el
    diálogo y devuelto al disparador al cerrar. Patrón combobox/listbox de ARIA
    (lo da `cmdk`).

### Analítica y privacidad (spec 24)
13. Evento nuevo `global_search_used` con propiedades
    `{ result_kind: 'client' | 'state' | 'trade' | 'glossary' | 'action' | 'none', via: 'shortcut' | 'button' }`,
    emitido al elegir un resultado o al cerrar sin elegir (`none`). **Nunca** se
    envía el texto buscado ni el id del resultado. Actualizar `AnalyticsEvents`
    y la tabla del spec 24.

## Diseño técnico
- `npx shadcn add command` (agrega `cmdk`) → `components/ui/command.tsx`.
- `components/layout/GlobalSearch.tsx`: diálogo + lógica; se monta una vez en
  `AppLayout`. Cargarlo con `lazy()` para no engordar el chunk inicial.
- `lib/globalSearch.ts` (puro, testeable): `searchAll(query, { clients, states, trades, glossary })`
  → grupos con sus topes. Reutiliza los filtros existentes; para oficios y
  glosario extraer el filtro que hoy vive dentro de las páginas a una función
  compartida con `normalizeSearchText`.
- `Trades` y `Glossary` leen `location.state?.search` como valor inicial.
- Debounce con `useDebouncedValue` existente.

## Fuera de alcance
Buscar leads de la Agenda, llamadas, pagos o documentos; búsqueda en servidor;
búsqueda dentro de notas; atajos adicionales (`g c`, `n`…).

## Criterios de aceptación
- [ ] `Ctrl/⌘+K` abre el buscador desde cualquier página de `AppLayout`; `Esc` lo cierra y devuelve el foco.
- [ ] Escribir un teléfono parcial, un nombre sin acentos o el nombre de una LLC encuentra al cliente.
- [ ] Escribir "tex" o "TX" muestra Texas como primer resultado; `Enter` abre `/estados/TX`.
- [ ] Escribir un oficio en español muestra su nombre en inglés sin salir de la pantalla actual.
- [ ] Un `agent` no encuentra clientes de otro agente.
- [ ] Con el texto vacío aparecen las acciones y los recientes.
- [ ] "Agendar llamada" abre la Agenda con el modal de nueva llamada.
- [ ] En 375 px el buscador ocupa la pantalla y es usable con el teclado virtual abierto.
- [ ] Escribir no genera requests a Firestore (verificado en Network).
- [ ] `localStorage` de recientes no contiene nombres, teléfonos ni LLC.
- [ ] `global_search_used` no lleva texto ni ids; el spec 24 y `AnalyticsEvents` están actualizados.
- [ ] Tests unitarios de `searchAll`: topes por grupo, acentos, teléfono con y sin formato, texto vacío.
- [ ] El chunk inicial no crece más de ~1 KB gzip (componente en diferido).
- [ ] `npm run build`, `npm run lint` y `npm test` pasan.

## Preguntas abiertas
1. **Volumen de clientes por workspace:** el filtro en memoria es instantáneo con
   miles de clientes. Si algún workspace supera ~10 000, hay que revisar (también
   afecta al spec 28). ¿Cuál es el máximo hoy?
2. **Archivados:** recomiendo excluirlos en v1 (requieren una segunda query,
   `useClients({ archived: true })`). Alternativa: incluirlos en un grupo aparte
   "Archivados" que se carga solo al abrir el buscador.
4. **Oficios y Glosario:** tuvieron 0 uso en 30 días. Recomiendo incluirlos
   igual (el costo es bajo y es la forma de saber si no se usan por inútiles o
   por estar escondidos), pero si hay que recortar alcance, son lo primero que sale.
3. **Leads de la Agenda (spec 19):** las 7 llamadas agendadas del periodo fueron
   todas a leads, así que este caso es real. ¿Hace falta encontrarlos por
   teléfono desde aquí cuando el lead devuelve la llamada?
