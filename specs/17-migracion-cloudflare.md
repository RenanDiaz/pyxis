# 17 — Migración a Cloudflare Workers y dominio propio

**Prioridad:** 🔴 Alta (bloquea 18) · **Estado:** propuesto · **Tamaño:** M (poco código, mucha configuración manual)

## Problema
- **Términos de Vercel:** Pyxis está en Vercel **Hobby**, que no permite uso comercial. Pyxis es una herramienta de ventas, así que hoy ya incumple.
- **Hace falta backend:** el spec 18 (links de pago) necesita código en el servidor para guardar secretos. No queremos pasar Firebase a Blaze ni pagar Vercel Pro.
- **Dominio:** la app vive en el dominio del hosting. Un dominio propio da estabilidad para OAuth, Stripe y los links que se comparten, y hace que la próxima migración de hosting no le cambie la URL a nadie.

## Decisión
- **Hosting:** **Cloudflare Workers con static assets**, en el plan gratuito, que sí permite uso comercial. Un solo Worker sirve la SPA y las rutas `/api/*`. Mismo origen, así que no hay CORS.
  - Las requests a archivos estáticos no consumen la cuota del Worker. El plan gratuito incluye 100k invocaciones/día.
- **Dominio:** comprarlo en **Cloudflare Registrar**.
  - Lo vende a precio de costo y sin recargo, con privacidad WHOIS gratis.
  - El DNS queda en Cloudflare desde el día 1, así que no hay cambio de nameservers.
  - Preferir `.com`.
- **Entornos:**

  | Entorno | Worker | Dominio | Rama |
  |---|---|---|---|
  | Producción | `pyxis` | `<dominio>` (+ `www` → redirect) | `main` |
  | Staging | `pyxis-staging` | `staging.<dominio>` | todas las demás |

  Staging hace falta antes del spec 18: es donde vivirán las claves de **prueba** de Stripe. Los *preview URLs* por versión del Worker de producción compartirían los secretos de producción, por eso no se usan.
- **Firebase no cambia:** mismo proyecto, mismo plan Spark. Las reglas y la configuración `VITE_FIREBASE_*` quedan iguales.

## Fuera de alcance
- Código del spec 18. Esta migración solo deja el Worker con un `GET /api/health` para probar el enrutamiento.
- Email transaccional. **Email Routing** de Cloudflare (gratis) sí entra: reenvía `soporte@<dominio>` a un buzón personal, y Stripe lo pide como contacto de soporte de la plataforma.

## Cambios en el repo (un PR)
1. **`wrangler.jsonc`** en la raíz:
   - `name: "pyxis"`, `main: "worker/index.ts"`, `compatibility_date` con la fecha del día de implementación.
   - `assets: { directory: "./dist", binding: "ASSETS", not_found_handling: "single-page-application", run_worker_first: ["/api/*"] }`.
   - `env.staging` con `name: "pyxis-staging"` y sus `routes` / custom domain.
   - `alias: { "@": "./src" }`, para que el Worker pueda importar módulos puros de `src/lib` (spec 18).
2. **`worker/index.ts`:** router mínimo.
   - `GET /api/health` → `{ ok: true, version }`.
   - Cualquier otra ruta `/api/*` → 404 en JSON.
   - Todo lo demás → `env.ASSETS.fetch(request)`. **Nunca** un 404 propio para rutas que no son de la API, porque rompería los deep links.
3. **`tsconfig.worker.json`:** tipos generados con `wrangler types`. Se agrega a `tsc -b`.
4. **Versión (spec 14):**
   - En `vite.config.ts`: `APP_VERSION = process.env.WORKERS_CI_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || build-${Date.now()}`. Vercel se quita cuando termine el corte.
   - `public/_headers` con `/version.json` → `Cache-Control: no-store`. Reemplaza el header de `vercel.json`.
5. **Scripts en `package.json`:**
   - `deploy` → `wrangler deploy`.
   - `dev:api` → `wrangler dev --port 8787`.
   - `wrangler` como devDependency **con versión fija**, porque Workers Builds usa la de `package.json`.
6. **`vite.config.ts`:** `server.proxy` de `/api` → `http://localhost:8787`. En local se corren `npm run dev` y `npm run dev:api` a la vez.
   - *Alternativa descartada:* `@cloudflare/vite-plugin`. Une ambos en un proceso, pero cambia la estructura de `dist/` y agrega una pieza más justo en la migración. Se puede reconsiderar después.
7. **`.dev.vars.example`:** vacío por ahora. El spec 18 agrega los secretos. `.dev.vars` va a `.gitignore`.
8. **Docs:** `CLAUDE.md` y `README.md`: Deploy → Cloudflare Workers, con un enlace a este runbook.
9. **`vercel.json`:** **no se borra en este PR**. Se borra en un PR de limpieza cuando termine el periodo de redirect (paso 8 del runbook).

## Runbook manual
Marcar cada paso al hacerlo. Lo que dice *verificar* depende de la consola de Cloudflare o Stripe al momento de hacerlo, porque las pantallas cambian.

### Paso 0 — Cuenta y dominio
- [ ] Crear la cuenta de Cloudflare con un correo que no sea personal, si es posible, y activar 2FA.
- [ ] **Domain Registration → Register Domains:** comprar `<dominio>` con renovación automática.
- [ ] **Email → Email Routing:** activar y crear `soporte@<dominio>` → buzón personal. Verificar el buzón destino.

### Paso 1 — Conectar el repo (Workers Builds)
- [ ] **Workers & Pages → Create → Import a repository:** `RenanDiaz/pyxis`, rama de producción `main`.
- [ ] **Build command:** `npm run build`. **Deploy command:** `npx wrangler deploy`.
- [ ] **Non-production branch deploy command:** `npx wrangler deploy --env staging`. *(Verificar que el token de Builds tenga permiso sobre el Worker `pyxis-staging`. Si no, crear ese Worker conectado al mismo repo, con su propio comando).*
- [ ] **Build variables** (Settings → Build → Variables): las 6 `VITE_FIREBASE_*`.
  - ⚠️ Son variables **de build**, no de runtime. Si se ponen en "Variables & Secrets", el bundle sale sin Firebase y la app muestra la pantalla de "no configurado".
  - Copiarlas de Vercel → Settings → Environment Variables.

### Paso 2 — Primer deploy y pruebas en `*.workers.dev`
- [ ] Hacer merge del PR o ejecutar el deploy desde la rama. Abrir `https://pyxis.<cuenta>.workers.dev`.
- [ ] Login con **email/password**. Google todavía no va a funcionar: falta autorizar el dominio en el paso 3.
- [ ] Hacer los checks de la sección *Criterios de aceptación*.

### Paso 3 — Firebase y Google
- [ ] **Firebase Console → Authentication → Settings → Authorized domains:** agregar `<dominio>`, `staging.<dominio>` y `pyxis.<cuenta>.workers.dev`. No acepta comodines.
- [ ] **Google Cloud Console → APIs & Services → Credentials → la API key del navegador:**
  - Si tiene *restricción por HTTP referrer*, agregar `https://<dominio>/*` y `https://staging.<dominio>/*`.
  - Si no tiene restricción, no hay que hacer nada aquí. Conviene ponerla después del corte.
- [ ] **Storage CORS:** `cors.json` usa `origin: ["*"]`, así que no hay cambio. *(Si algún día se restringe, agregar el dominio).*
- [ ] Probar el login con Google en `workers.dev`.

### Paso 4 — Dominio en el Worker
- [ ] **Worker `pyxis` → Settings → Domains & Routes → Add → Custom domain:** `<dominio>` y `www.<dominio>`.
- [ ] **Redirect `www` → apex:** con una regla en **Rules → Redirect Rules**, código 301.
- [ ] **Worker `pyxis-staging` → Custom domain:** `staging.<dominio>`.
- [ ] **SSL/TLS:** modo *Full (strict)* y *Always Use HTTPS* activo.

### Paso 5 — Corte
Hacerlo fuera de horario de llamadas.
- [ ] Avisar a los agentes de la nueva URL y de lo siguiente:
  - **Tienen que volver a iniciar sesión.** La sesión de Firebase se guarda por dominio.
  - **Los borradores de formularios del dominio viejo no se pasan al nuevo.** Están en `localStorage`. Antes del corte, que terminen o guarden lo que tengan a medias.
- [ ] Hacer los checks finales en `<dominio>`.
- [ ] **Vercel:** deploy de un `vercel.json` que solo haga redirect 308 de `/(.*)` → `https://<dominio>/$1`.
  - Las pestañas viejas no se enteran por el aviso de versión: el `fetch` a `/version.json` redirige a otro origen y falla por CORS. Por eso hace falta el aviso del punto anterior.

### Paso 6 — Monitoreo (primera semana)
- [ ] **Workers → pyxis → Metrics:** errores 5xx y requests/día. Ver que esté lejos de 100k.
- [ ] **Firebase → Usage:** que las lecturas no hayan cambiado.

### Paso 7 — Rollback
Si algo falla en los primeros días:
- [ ] Quitar el redirect de Vercel, volviendo a hacer deploy del commit anterior al corte, y avisar a los agentes que vuelvan a la URL vieja.
- [ ] Firebase no cambió, así que no hay datos que revertir.

### Paso 8 — Limpieza (2–4 semanas después)
- [ ] Borrar el proyecto de Vercel y `vercel.json`. Quitar `VERCEL_GIT_COMMIT_SHA` de `vite.config.ts`.
- [ ] Quitar `pyxis.<cuenta>.workers.dev` de los dominios autorizados de Firebase, si ya no se usa.

## Criterios de aceptación
- [ ] `https://<dominio>/clientes/<id>` con recarga dura carga la app, no un 404. El fallback SPA funciona.
- [ ] `curl -I https://<dominio>/assets/no-existe.js` devuelve **404**, no `index.html` (spec 14).
  - *Si devuelve 200 con HTML:* agregar `"/assets/*"` a `run_worker_first`, y que el Worker devuelva 404 cuando `ASSETS.fetch` responda HTML para una ruta bajo `/assets/`.
- [ ] `curl -I https://<dominio>/version.json` → `Cache-Control: no-store`, y el contenido coincide con el commit desplegado.
- [ ] `GET /api/health` → `{ ok: true, version }`. `GET /api/otra` → 404 en JSON.
- [ ] Login con Google y con email/password en `<dominio>` y en `staging.<dominio>`.
- [ ] Subir y descargar un documento de Storage, y exportar `.docx` y `.xlsx`. Esto prueba los chunks lazy.
- [ ] Un push a otra rama hace deploy en `staging.<dominio>` y **no** toca producción.
- [ ] `tsc -b` y `npm run lint` pasan, incluido `worker/`.

## Preguntas abiertas
- **Nombre del dominio:** lo decide el dueño del producto. No bloquea el código: el PR usa `<dominio>` como placeholder en `wrangler.jsonc` hasta comprarlo.
