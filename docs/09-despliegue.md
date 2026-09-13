# Despliegue: Render (API) + Vercel (frontends)

Guía para dejar el sistema en línea **sin clonar el repositorio**. Todo se hace
desde los paneles web, conectando cada servicio a GitHub.

```
  Visitante ──▶ Vercel: landing      ─┐
  Academia  ──▶ Vercel: admin        ─┼──▶ Render: API ──▶ Supabase (Postgres)
  Alumno    ──▶ Vercel: cliente PWA  ─┘         │                   ▲
                      │                         └───────────────────┘
                      └──────────────▶ Supabase Auth (login)     Storage
```

**El orden importa.** Render aplica las migraciones al desplegar, así que la
API va primero: eso crea las tablas en Supabase y destraba todo lo demás.

---

## Dónde vive cada cosa

La base ya está en **East US (North Virginia), `us-east-1`**, así que **el
servicio de Render tiene que crearse en Virginia** (o, si no estuviera
disponible, Ohio). API y base quedan juntas.

Por qué importa: lo que más pesa no es la distancia al usuario, sino la
distancia **entre la API y la base**. Una visita genera pocas llamadas a la API,
pero cada llamada genera varias consultas a la base. Con las dos en la misma
región, esas consultas cuestan milisegundos en vez de cruzar el continente.

El usuario en Uruguay paga una sola ida y vuelta hasta Estados Unidos por
petición, que es inevitable: Render no tiene región en Sudamérica.

### Antes de seguir: dar de baja el proyecto Supabase anterior

Si quedó un proyecto viejo en São Paulo, **borralo** (Project Settings →
General → Delete project).

No es prolijidad: sus credenciales se expusieron en una conversación de chat y
**siguen siendo válidas mientras el proyecto exista**. Borrarlo las anula de
raíz, que es más seguro que rotarlas.

### Sobre las credenciales del proyecto nuevo

**No las pegues en ningún chat.** Copialas del panel de Supabase directamente a
los campos de Render y de Vercel. Cada vez que una credencial pasa por un
mensaje, hay que rotarla después.

---

## Fase 1 — API en Render

### 1.1 Crear el servicio

En [dashboard.render.com](https://dashboard.render.com): **New → Web Service**,
conectar la cuenta de GitHub y elegir `ats_academia_gimenoos`.

| Campo | Valor |
|---|---|
| Name | `gimenoos-api` |
| Language / Runtime | **Node** |
| Branch | `main` |
| Region | **Virginia (US East)** — la misma que la base |
| Root Directory | *(vacío — el build corre desde la raíz del monorepo)* |
| Instance Type | Free |

**Build Command:**

```
corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm --filter @gimenoos/api prisma:generate && pnpm --filter @gimenoos/api build
```

**Start Command:**

```
pnpm --filter @gimenoos/api prisma:deploy && pnpm --filter @gimenoos/api prisma:seed && node apps/api/dist/main.js
```

**Health Check Path:** `/api/v1/health`

> **Por qué `--prod=false`:** con `NODE_ENV=production`, pnpm omite las
> devDependencies. Sin ellas no hay compilador (`nest build`) ni `ts-node` para
> el seed, y el build falla. Este parámetro las fuerza.
>
> **Por qué `prisma:generate` antes de compilar:** el cliente de Prisma se
> genera a partir del esquema; sin él los tipos no existen.
>
> **Por qué las migraciones van en el arranque:** si fallan, el servicio no
> levanta. Es preferible a quedar sirviendo sobre un esquema a medias.
>
> El seed es idempotente (usa `upsert`) y garantiza que exista la fila de
> configuración que consume la landing.

### 1.2 Variables de entorno

En **Environment**, cargar:

| Variable | Valor |
|---|---|
| `NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `COREPACK_ENABLE_DOWNLOAD_PROMPT` | `0` |
| `DATABASE_URL` | Pooler de Supabase, puerto **6543**, con `?pgbouncer=true` |
| `DIRECT_URL` | Conexión de Supabase, puerto **5432** |

> Las dos cadenas se copian tal cual del panel: **Project Settings → Database →
> Connection string**. El host incluye la región (`...us-east-1.pooler.supabase.com`),
> así que no conviene escribirlo a mano. A `DATABASE_URL` hay que agregarle
> `?pgbouncer=true` si no viene incluido.
>
> Si la contraseña tiene caracteres especiales (`@ : / ? # & %`), hay que
> codificarlos en URL o la cadena se interpreta mal.

Resto de las variables:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | `https://<REF>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | La clave `service_role` |
| `SUPABASE_JWT_LEGACY_SECRET` | **Vacía**, salvo lo que diga JWT Keys (ver abajo) |
| `CORS_ORIGINS` | Provisorio: `https://localhost` — se completa en la Fase 4 |
| `THROTTLE_TTL_SEGUNDOS` | `60` |
| `THROTTLE_LIMITE` | `100` |

**No definir `PORT`:** lo asigna Render y la API lo lee de ahí.

> **`SUPABASE_JWT_LEGACY_SECRET`:** mirá **Settings → JWT Keys**. Si dice que el
> secreto heredado ya migró a *JWT Signing Keys* —lo habitual en proyectos
> nuevos—, la variable va **vacía** y los tokens se verifican contra el JWKS.
> Solo si el proyecto todavía usa el secreto compartido hay que cargarlo ahí.

> Alternativa: el repositorio incluye `render.yaml`, que se puede usar con
> **New → Blueprint** en lugar de cargar todo a mano. Los secretos igual se
> piden en el panel; nunca están en el repositorio.

### 1.3 Desplegar y verificar

Al terminar el deploy, en los logs tiene que aparecer que las migraciones se
aplicaron y después `API escuchando ... (entorno: production)`.

Verificar, en este orden:

1. **Las tablas existen.** En Supabase → Table Editor deben verse `usuarios`,
   `clientes`, `instructores`, `vehiculos`, `reservas`, `servicios`… Si sigue
   vacío, las migraciones no corrieron: revisar los logs del deploy.
2. **La API responde.** Abrir `https://gimenoos-api.onrender.com/api/v1/health`
   → `{"estado":"ok", ...}`
3. **El catálogo responde.** `/api/v1/catalogo/servicios` → lista de servicios.
4. **La documentación NO está publicada.** `/api/v1/docs` → 404. Correcto: no se
   expone el mapa de la API en producción.

---

## Fase 2 — Storage en Supabase

**Ahora sí funciona**, porque la Fase 1 creó la tabla `usuarios`.

En Supabase → **SQL Editor**, ejecutar `infra/supabase/01-storage.sql` (copiar
el contenido desde GitHub). Después confirmar en **Storage** que `comprobantes`
y `expedientes` figuren como **Private**.

---

## Fase 3 — Frontends en Vercel

Son **tres proyectos separados**, los tres apuntando al mismo repositorio.

### ⚠️ Lo que hay que cambiar sí o sí: el Root Directory

Al importar el repositorio, **Vercel detecta que es un monorepo y preselecciona
una subcarpeta** (`apps/admin`, por ejemplo). Hay que tocar **Edit** y dejarlo
en la **raíz del repositorio**, en los tres proyectos.

Si no se cambia, pasa esto: el Build Command construye una app, pero Vercel
busca el resultado **dentro de la subcarpeta preseleccionada**, que está vacía.
El build dice `✓ built` y el deploy falla igual, con este error:

```
Error: No Output Directory named "dist" found after the Build completed.
```

Cómo confirmar que quedó bien: en el log de instalación, las dependencias que
aparecen tienen que ser **las de la app que se está construyendo**. Si el
proyecto es la landing y ves `@supabase/supabase-js` o `react-router-dom`, el
Root Directory apunta a otra app — la landing no usa ninguna de las dos.

**Por qué la raíz y no la carpeta de la app:** es un monorepo pnpm y los
paquetes se enlazan entre sí. Desde la raíz, las dependencias del workspace se
resuelven sin ajustes adicionales, y Vercel toma el `vercel.json` de la raíz —
que es el que trae el *fallback* de rutas y las cabeceras de seguridad. Con el
Root Directory dentro de `apps/`, ese archivo no se aplica y el panel y la PWA
dan 404 al recargar cualquier ruta.

### Configuración de cada proyecto

**Los cuatro campos se cambian juntos.** Copiar el Build Command de un proyecto
al otro sin cambiar el resto es la forma más fácil de romper el deploy.

| Campo | `gimenoos-landing` | `gimenoos-admin` | `gimenoos-cliente` |
|---|---|---|---|
| Root Directory | **raíz del repo** | **raíz del repo** | **raíz del repo** |
| Install Command | `pnpm install --frozen-lockfile` | ídem | ídem |
| Build Command | `pnpm --filter @gimenoos/landing build` | `pnpm --filter @gimenoos/admin build` | `pnpm --filter @gimenoos/cliente build` |
| Output Directory | `apps/landing/dist` | `apps/admin/dist` | `apps/cliente/dist` |

**Framework Preset:** con el Root Directory en la raíz, el preset no aporta
nada, porque el build y la salida están definidos explícitamente. Si Vercel
insiste con un valor por defecto que pisa el Output Directory, poné **Other**.

Los tres interruptores de *override* (Build, Output, Install) tienen que quedar
**activados**: si están apagados, Vercel usa sus valores por defecto y el deploy
falla aunque el campo muestre el texto correcto.

### Variables de entorno

| Variable | landing | admin | cliente |
|---|:---:|:---:|:---:|
| `VITE_API_URL` = `https://gimenoos-api.onrender.com/api/v1` | sí | sí | sí |
| `VITE_SUPABASE_URL` = `https://<REF>.supabase.co` | — | sí | sí |
| `VITE_SUPABASE_ANON_KEY` = clave `anon` | — | sí | sí |

> **Solo la clave `anon`.** Cualquier variable `VITE_` termina dentro del
> JavaScript que descarga el visitante. La `service_role` jamás va acá — el CI
> tiene un control que falla si alguien lo intenta.
>
> La landing no necesita claves de Supabase: no tiene login.

El `vercel.json` de la raíz ya resuelve, para los tres: el *fallback* de rutas
para react-router, que el service worker de la PWA nunca se cachee, el cacheo
permanente de los assets versionados y las cabeceras de seguridad.

### Si un deploy falla

| Error | Causa | Solución |
|---|---|---|
| `No Output Directory named "dist" found` | El Root Directory apunta a una subcarpeta, o el override del Output Directory está apagado | Root Directory en la raíz y Output Directory en `apps/<app>/dist`, con el override activado |
| Se instalan dependencias de otra app | El Root Directory apunta a la app equivocada | Ídem |
| `ERR_PNPM_OUTDATED_LOCKFILE` | El `pnpm-lock.yaml` no coincide con los `package.json` | Rehacer el lockfile en una rama y mergear; no quitar `--frozen-lockfile` |
| Recargar una ruta del panel o la PWA da 404 | No se aplicó el `vercel.json` de la raíz | El Root Directory tiene que estar en la raíz |

### Evitar builds innecesarios (opcional)

Como los tres proyectos miran el mismo repositorio, cada push los reconstruye a
los tres. En **Settings → Git → Ignored Build Step**, poner en cada uno:

```
git diff --quiet HEAD^ HEAD -- apps/<APP> packages pnpm-lock.yaml vercel.json
```

reemplazando `<APP>` por `landing`, `admin` o `cliente`.

---

## Fase 4 — Conectar las piezas

Ya existen las URLs definitivas. Ahora se cierran los permisos.

### 4.1 CORS en Render

Actualizar `CORS_ORIGINS` con las tres URLs de Vercel, separadas por coma, **sin
barra final**:

```
https://gimenoos-landing.vercel.app,https://gimenoos-admin.vercel.app,https://gimenoos-cliente.vercel.app
```

Guardar dispara un redeploy. Sin esto, los frontends no pueden llamar a la API.

### 4.2 Redirect URLs en Supabase Auth

**Authentication → URL Configuration**:

- *Site URL*: la URL de la PWA del alumno.
- *Redirect URLs*: agregar las URLs del panel y de la PWA.

Supabase solo redirige a URLs de esa lista: sin esto, el enlace de ingreso por
correo no funciona.

### 4.3 Primer administrador

1. **Authentication → Users → Add user**, con correo y contraseña.
2. Ingresar una vez al panel. **Es esperable que aparezca "Acceso restringido"**:
   toda cuenta nueva nace con rol `CLIENTE`, y ese primer ingreso es justamente
   lo que crea su fila en `usuarios`.

   > Que aparezca esa pantalla —y no un error— confirma que la cadena completa
   > funciona: CORS, la verificación del token contra el JWKS del proyecto y el
   > alta automática del usuario en la base.

3. En **SQL Editor**, promoverlo:
   ```sql
   UPDATE usuarios SET rol = 'ADMIN' WHERE email = 'correo@delAdmin.com';
   ```
4. **Recargar el panel.** No hace falta volver a iniciar sesión: el rol se lee de
   la base en cada petición, no del token. Por eso un cambio de rol —o dar de
   baja una cuenta— tiene efecto inmediato, sin esperar a que expire el JWT.

Para verificar antes de recargar:

```sql
SELECT email, rol, activo FROM usuarios;
```

---

## Fase 5 — Verificación de punta a punta

- [ ] La landing abre y **muestra los servicios** (si los muestra, la cadena
      Vercel → Render → Supabase funciona completa).
- [ ] El panel permite iniciar sesión con el administrador (tras el `UPDATE` del
      paso 4.3; antes de eso, "Acceso restringido" es lo correcto).
- [ ] El panel muestra el catálogo en *Servicios y precios*.
- [ ] La PWA envía el enlace de ingreso por correo y permite entrar.
- [ ] La PWA ofrece instalarse en el teléfono.
- [ ] `/api/v1/docs` responde 404.
- [ ] Los buckets figuran como *Private*.

---

## Limitaciones conocidas del plan gratuito

**El servicio de Render se suspende por inactividad.** La primera visita después
de un rato tarda cerca de un minuto en responder, porque el servicio tiene que
volver a arrancar. Para una academia que recibe consultas durante el día es
molesto pero tolerable; el plan pago lo elimina.

Consecuencia práctica: si la landing tarda en mostrar los precios, es esto. La
página está diseñada para no romperse — si la API no responde, invita a
consultar por WhatsApp en lugar de mostrar un error.

**Las previsualizaciones de Vercel no van a poder llamar a la API.** Cada
*preview* recibe una URL distinta que no está en `CORS_ORIGINS`. Es lo correcto
desde el punto de vista de seguridad: la lista de orígenes es explícita. Para
probar una rama contra la API, agregar esa URL temporalmente.

---

## Despliegues posteriores

Ya no hay nada manual:

- Un merge a `main` dispara el CI. Si queda en verde y los checks están marcados
  como obligatorios, se puede mergear.
- Render reconstruye la API y **aplica las migraciones nuevas** automáticamente.
- Vercel reconstruye los frontends.

Si una migración falla, el servicio de Render no arranca y queda sirviendo la
versión anterior. Los logs del deploy dicen qué pasó.
