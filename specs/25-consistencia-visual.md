# 25 — Consistencia visual (base del rediseño)

**Prioridad:** 🟠 Alta (base de 26–29) · **Estado:** pendiente · **Tamaño:** M · **Depende de:** — · **Relacionado:** [13](13-ux-accesibilidad.md)

## Problema
Conviven dos generaciones de UI. `StateDetail`, `Home` y `ClientDetail` se
rehicieron (paneles `rounded-2xl`, títulos `font-extrabold`, sombras); `Clients`,
`Schedule`, `States`, `Trades`, `Glossary`, `Reports` y `ClientForm` siguen con
el estilo anterior. El usuario lo percibe como pantallas de apps distintas.

## Diagnóstico (verificado en el código, 2026-11-10)
1. **Colores fuera del tema:** ~230 clases de color directas
   (`text-amber-700`, `bg-violet-100`, `border-green-…`) en 19 archivos. Los que
   más: `ExportReportDialog` y `StatusBadge` (30 c/u), `StateDetail` y `Schedule`
   (22), `PaymentSection` y `OutcomeBadge` (18), `ClientDetail` (17).
2. **Tokens muertos:** `index.css` define `--color-status-*` y nadie los usa;
   `StatusBadge` repite cada color con sus variantes `dark:` a mano.
3. **Encabezados de página:** 15 `<h1>` con clases copiadas, unos `font-bold` y
   otros `font-extrabold`. Uno de ellos es el "Pyxis" del sidebar (dos `<h1>`
   por página).
4. **Estados vacíos:** el mismo bloque (ícono + texto + botón) copiado en 4 sitios.
5. **Carga:** `StateDetail` muestra el texto "Cargando..."; otras páginas usan
   skeletons; `AppLayout` usa "Cargando workspace...".
6. **Sin ancho máximo:** `<main>` solo tiene padding; en monitores anchos las
   grillas y los párrafos se estiran sin límite.

## Alcance
Solo presentación. **No** cambia paleta, tipografía (Inter), rutas, datos ni
comportamiento. No se rediseña ninguna pantalla: se unifican las que ya existen
hacia el estilo de `StateDetail`/`Home`/`ClientDetail`.

**Fuera de alcance:** partir `ClientForm` en pasos, PDFs/recibos/.docx/.xlsx
(tienen su propio branding), `Login`/`Onboarding`/`JoinWorkspace` salvo tokens.

## Requisitos
1. **Tokens semánticos** en `index.css` (`@theme` + `.dark`), cada uno con
   fondo suave, texto y borde:

   | Token | Uso | Hoy |
   |---|---|---|
   | `success` | pagado, buena hora para llamar, cerrado | `green-*`, `emerald-*` |
   | `warning` | vencido, zona horaria dudosa, archivados, borradores | `amber-*`, `yellow-*` |
   | `info` | nuevo, avisos neutros | `blue-*`, `sky-*` |
   | `debt` | deuda pendiente | `violet-*` |
   | `destructive` | ya existe | `red-*`, `rose-*` |

   Los 6 status de cliente usan los `--color-status-*` existentes (ampliados con
   fondo/texto para claro y oscuro). `StatusBadge` y `OutcomeBadge` dejan de
   llevar clases `dark:` propias. **Los colores visibles no cambian** (mismos
   tonos que hoy; spec 13 ya validó contraste y daltonismo).
2. **Regla:** en `src/pages` y `src/components` (salvo `ui/`) no quedan clases
   `(text|bg|border)-<color>-<n>` de Tailwind. Excepción documentada: el verde
   de marca de WhatsApp (`#25D366`) y el degradado del hero de `StateDetail`,
   que pasan a tokens `--color-whatsapp` y `--color-primary` respectivamente.
   Agregar un test en `tests/unit` que falle si reaparecen (grep sobre `src/`).
3. **Componentes compartidos** en `src/components/shared/`:
   - `PageHeader({ title, description?, back?, actions? })` — único lugar con
     `<h1>`; estilo `text-2xl font-extrabold tracking-tight`. Lo usan todas las
     páginas dentro de `AppLayout`.
   - `EmptyState({ icon, title, description?, action? })` — reemplaza los 4 bloques copiados.
   - `StatCard({ label, value, hint?, tone? })` — las 4 métricas de `Home` y los
     paneles de precio de `StateDetail`.
4. **Sidebar:** "Pyxis" deja de ser `<h1>` (pasa a `<span>`/link al inicio).
5. **Radios y elevación:** `Card` (`rounded-xl`) para contenido; `rounded-2xl`
   solo para el panel de cabecera de una página de detalle. Sombras solo en
   cabeceras y popovers. Aplicar a las páginas del estilo anterior.
6. **Ancho máximo:** el contenido de `<main>` se centra con `max-w-[1440px]`.
   Los formularios (`ClientForm`) conservan su grilla actual.
7. **Carga:** una sola convención — skeleton con la forma del contenido en
   listas y detalle; `PageLoader` para el cambio de ruta. Se elimina el texto
   "Cargando..." de `StateDetail`.
8. Respetar las reglas de layout de `CLAUDE.md` (scroll nativo, `dvh`, sin
   `overflow` en `html/body/#root`).

## Criterios de aceptación
- [ ] `grep -rE '(text|bg|border)-(red|green|blue|amber|yellow|orange|violet|emerald|rose|sky|gray)-[0-9]+' src/pages src/components --include=*.tsx` solo devuelve `src/components/ui/`.
- [ ] El test de clases de color pasa y falla si se agrega una clase directa.
- [ ] Los 6 badges de status y los de resultado de llamada se ven igual que antes en claro y oscuro (comparación visual lado a lado).
- [ ] Todas las páginas de `AppLayout` usan `PageHeader`; hay exactamente un `<h1>` por página.
- [ ] `Clients`, `Schedule`, `States`, `Trades`, `Glossary` y `Reports` usan `EmptyState` donde aplica.
- [ ] En un viewport de 1920 px el contenido no supera 1440 px y queda centrado.
- [ ] Ninguna pantalla muestra el texto "Cargando..." suelto.
- [ ] Revisado en 375 px, 768 px y 1440 px, en claro y oscuro, sin scroll horizontal.
- [ ] `npm run build`, `npm run lint` y `npm test` pasan.

## Preguntas abiertas
1. **¿Un PR o varios?** Recomiendo 3: (a) tokens + `StatusBadge`/`OutcomeBadge` +
   test, (b) `PageHeader`/`EmptyState`/`StatCard` + ancho máximo, (c) migración
   del resto de clases de color. Así cada uno se revisa visualmente por separado.
2. **`ExportReportDialog` (30 clases):** ¿sus colores replican el Excel original a
   propósito? Si sí, se documenta como excepción en vez de migrarlo.
