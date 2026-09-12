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

## Decisión previa: dónde vive la base

Render **no tiene región en Sudamérica**. El proyecto Supabase actual está en
São Paulo (`sa-east-1`). Si la API queda en Estados Unidos y la base en Brasil,
**cada consulta cruza el continente**: una pantalla que hace cinco consultas
paga ese viaje cinco veces.

Lo que más pesa no es la distancia al usuario, sino la distancia **entre la API
y la base**: una visita genera pocas llamadas a la API, pero cada llamada genera
varias consultas a la base.

| Opción | API ↔ Base | Recomendación |
|---|---|---|
| **A.** Recrear el proyecto Supabase en **East US** y Render en Virginia/Ohio | milisegundos | ✅ Recomendada |
| **B.** Dejar Supabase en São Paulo, Render en Virginia/Ohio | ~100–200 ms por consulta | Funciona, pero se nota |

**La opción A hoy es barata**: el proyecto todavía no tiene datos. Y tiene un
beneficio extra — al crear un proyecto nuevo, las credenciales que se expusieron
en una conversación (contraseña de la base y `service_role`) quedan
automáticamente reemplazadas, sin tener que rotarlas aparte.

Si elegís A: creá el proyecto nuevo en East US **antes** de seguir, y usá sus
credenciales en todo lo que viene. El proyecto viejo se puede borrar.

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
| Region | La más cercana a la base (ver decisión previa) |
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
| `SUPABASE_URL` | `https://<REF>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | La clave `service_role` |
| `SUPABASE_JWT_LEGACY_SECRET` | **Vacía** (el proyecto usa JWT Signing Keys) |
| `CORS_ORIGINS` | Provisorio: `https://localhost` — se completa en la Fase 4 |
| `THROTTLE_TTL_SEGUNDOS` | `60` |
| `THROTTLE_LIMITE` | `100` |

**No definir `PORT`:** lo asigna Render y la API lo lee de ahí.

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

### Configuración común

En [vercel.com/new](https://vercel.com/new) → importar `ats_academia_gimenoos`.
Para cada proyecto:

| Campo | Valor |
|---|---|
| Root Directory | *(dejar en la raíz del repositorio)* |
| Framework Preset | Vite |
| Install Command | `pnpm install --frozen-lockfile` |

> **Por qué la raíz y no `apps/landing`:** es un monorepo pnpm y los paquetes se
> enlazan entre sí. Construyendo desde la raíz, las dependencias del workspace
> se resuelven sin depender de ajustes adicionales.

### Los tres proyectos

| Proyecto | Build Command | Output Directory |
|---|---|---|
| `gimenoos-landing` | `pnpm --filter @gimenoos/landing build` | `apps/landing/dist` |
| `gimenoos-admin` | `pnpm --filter @gimenoos/admin build` | `apps/admin/dist` |
| `gimenoos-cliente` | `pnpm --filter @gimenoos/cliente build` | `apps/cliente/dist` |

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
2. Que ingrese una vez al panel (así se crea su fila en `usuarios`).
3. En **SQL Editor**:
   ```sql
   UPDATE usuarios SET rol = 'ADMIN' WHERE email = 'correo@delAdmin.com';
   ```

---

## Fase 5 — Verificación de punta a punta

- [ ] La landing abre y **muestra los servicios** (si los muestra, la cadena
      Vercel → Render → Supabase funciona completa).
- [ ] El panel permite iniciar sesión con el administrador.
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
