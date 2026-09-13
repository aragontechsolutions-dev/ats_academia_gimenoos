# Configuración de Supabase

Guía paso a paso para conectar el sistema a un proyecto de Supabase.

> **El orden importa.** Las migraciones de Prisma (paso 3) crean las tablas de la
> aplicación, y el script de Storage (paso 5) depende de una de ellas. Si se
> ejecuta al revés, el script de Storage se detiene y avisa qué falta.

## 1. Crear el proyecto

En [supabase.com](https://supabase.com), proyecto nuevo:

- **Región**: la misma en la que va a correr la API, no la más cercana a
  Uruguay. Lo que domina el tiempo de respuesta es la distancia entre la API y
  la base, no la distancia al visitante. Con la API en Render, eso significa
  **East US (North Virginia)**. Ver [`09-despliegue.md`](09-despliegue.md).
- **Contraseña de la base**: generarla larga y guardarla en un gestor de
  contraseñas. Es la que va en `DATABASE_URL`.

## 2. Obtener las credenciales

**Project Settings → API**

| Valor | Variable | Dónde va |
|---|---|---|
| Project URL | `SUPABASE_URL` / `VITE_SUPABASE_URL` | Backend y frontends |
| `anon` / publishable key | `VITE_SUPABASE_ANON_KEY` | Solo frontends |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` | **Solo backend** |

> La `service_role` saltea RLS por completo. Si alguna vez aparece en un
> frontend, en un repositorio o en un log, hay que rotarla de inmediato.

**Project Settings → Database → Connection string**

| Modo | Puerto | Variable |
|---|---|---|
| Transaction pooler | 6543 | `DATABASE_URL` (agregar `?pgbouncer=true`) |
| Direct connection | 5432 | `DIRECT_URL` |

Ejemplo:

```env
DATABASE_URL="postgresql://postgres.<REF>:<PASS>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10"
DIRECT_URL="postgresql://postgres.<REF>:<PASS>@aws-0-<REGION>.pooler.supabase.com:5432/postgres"
```

**Por qué dos strings distintos:** la aplicación usa el pooler, que multiplexa
muchas conexiones lógicas sobre pocas físicas. Pero `prisma migrate` necesita una
conexión única y estable, sin pooling, o las migraciones fallan a la mitad. Por
eso Prisma expone `directUrl` como campo separado.

## 3. Aplicar el esquema

```bash
cd apps/api
cp .env.example .env      # y completar con los valores de arriba
pnpm supabase:setup       # migraciones + datos iniciales + verificación
```

`supabase:setup` encadena los tres pasos. Si preferís hacerlos por separado:

```bash
pnpm prisma:deploy        # aplica las migraciones ya versionadas
pnpm prisma:seed          # carga catálogo y configuración inicial
pnpm verificar            # diagnostica que todo haya quedado bien
```

`prisma:deploy` (y no `prisma:migrate`) es lo que se usa contra Supabase:
aplica las migraciones existentes sin intentar generar nuevas ni tocar una
shadow database.

> **La contraseña de la base no es la `service_role` ni la `anon`.** Es la que se
> definió al crear el proyecto, y va dentro de las dos cadenas de conexión. Si
> contiene caracteres especiales (`@ : / ? # & %`) hay que codificarlos en URL,
> o la cadena se interpreta mal y la conexión falla con un error confuso.

La extensión `btree_gist`, necesaria para las constraints de agenda, la crea la
propia migración.

## 4. Verificar que todo quedó bien

```bash
cd apps/api && pnpm verificar
```

Comprueba, y dice cómo arreglar cada cosa que falle:

- que no queden placeholders sin reemplazar en el `.env`;
- que `DATABASE_URL` use el pooler con `?pgbouncer=true` y `DIRECT_URL` el
  puerto 5432 (los dos errores de configuración más frecuentes);
- que la base conecte, tenga `btree_gist` y **las tres constraints
  anti-doble-reserva activas**;
- si el proyecto firma los tokens con claves asimétricas o con el secreto
  heredado, y si eso coincide con lo configurado;
- que los buckets existan y **sean privados**.

Conviene volver a correrlo después de cada cambio de configuración.

## 5. Configurar Storage

**Requiere el paso 3 hecho.** Las políticas consultan la tabla `usuarios`, que
crea Prisma, para saber quién es administrador.

En **SQL Editor**, ejecutar `infra/supabase/01-storage.sql`. Crea cuatro buckets
con sus políticas RLS. Se puede volver a ejecutar cuantas veces haga falta: no
duplica nada.

| Bucket | Visibilidad | Para qué |
|---|---|---|
| `comprobantes` | **Private** | Comprobantes de pago del alumno |
| `expedientes` | **Private** | Documentación del trámite de libreta |
| `graduados` | *Public* | Fotos de egresados, que se muestran en el sitio |
| `vehiculos` | *Public* | Fotos de los vehículos de la flota |

Verificar después en **Storage** que la visibilidad coincida con la tabla. Los
dos públicos lo son solo para **leer**: escribir en ellos requiere rol de
administrador. El detalle está en [17-fotos.md](17-fotos.md).

## 6. Configurar Auth

**Authentication → Providers**

- *Email* habilitado.
- Panel de administración: contraseña.
- PWA del alumno: enlace mágico (OTP por correo).

**Authentication → URL Configuration**

- *Site URL*: la URL de la PWA del alumno.
- *Redirect URLs*: agregar las URLs de desarrollo y producción de la PWA y del
  panel. Supabase solo redirige a URLs de esta lista.

**Authentication → Email Templates**: traducir las plantillas al español antes
de salir a producción. Los correos los recibe el alumno.

### Claves asimétricas (recomendado)

En **Settings → JWT Keys** se ve cuál de los dos esquemas usa el proyecto:

| Lo que muestra el panel | Qué poner en `SUPABASE_JWT_LEGACY_SECRET` |
|---|---|
| *"Legacy JWT secret has been migrated to new JWT Signing Keys"* | **Vacía.** Los tokens se firman con claves asimétricas y se verifican contra el JWKS |
| Solo el secreto heredado, sin signing keys | El JWT Secret. La API acepta HS256 como respaldo y avisa en el log |

Cuando el proyecto ya migró, **dejar la variable vacía no es opcional**:
completarla haría que la API acepte también tokens HS256 sin ninguna necesidad,
ampliando la superficie de ataque a cambio de nada.

> El aviso del panel sobre las API keys `anon` y `service_role` se refiere a que
> esas claves siguen siendo JWT heredados. Funcionan sin problema; migrar a las
> nuevas *publishable* y *secret* keys es una mejora aparte, no un requisito
> para que el sistema funcione.

## 7. Crear el primer administrador

**Nadie entra sin invitación**, ni siquiera con un token válido de Supabase. Para
el primero, que es el que después invita a todos los demás, hay una puerta de
arranque:

1. En el servidor (Render), cargar `ADMIN_INICIAL_EMAIL` con el correo del
   administrador.
2. **Authentication → Users → Add user**, con ese mismo correo y una contraseña.
3. Que ingrese una vez al panel: la cuenta se crea con rol `ADMIN`.
4. **Vaciar `ADMIN_INICIAL_EMAIL`.** Mientras esté puesta, quien controle esa
   casilla de correo puede crearse un administrador.

A partir de ahí, todo el mundo entra por invitación desde el panel. El detalle
está en [18-cuentas-e-invitaciones.md](18-cuentas-e-invitaciones.md).

## 8. Checklist antes de producción

- [ ] Buckets `comprobantes` y `expedientes` en **Private**
- [ ] `01-storage.sql` ejecutado y políticas visibles en la tabla `storage.objects`
- [ ] Redirect URLs de Auth limitadas a los dominios reales
- [ ] Plantillas de correo en español
- [ ] Claves asimétricas activas y `SUPABASE_JWT_LEGACY_SECRET` vacía
- [ ] `CORS_ORIGINS` de la API con los dominios reales (sin `localhost`)
- [ ] `NODE_ENV=production` (deshabilita Swagger)
- [ ] Copias de seguridad automáticas activadas (según el plan contratado)
- [ ] `service_role` fuera de todo frontend y de todo repositorio

## Problemas frecuentes

| Síntoma | Causa habitual |
|---|---|
| 401 en todas las rutas | Se intenta verificar el JWT con un secreto compartido cuando el proyecto firma con ES256, o `SUPABASE_URL` mal escrita |
| `prisma migrate` se cuelga o falla | Se está usando el pooler (6543) en `DIRECT_URL`; debe ser el puerto 5432 |
| "too many connections" | Falta `?pgbouncer=true` o `connection_limit` demasiado alto |
| Subida de archivo rechazada | MIME o tamaño fuera de lo permitido por el bucket, o la ruta no empieza con el UUID del usuario |
| `01-storage.sql` corta con *"Faltan las migraciones de la aplicación"* | Se ejecutó antes del paso 3. Correr `pnpm supabase:setup` y volver a ejecutarlo |
| `relation "public.usuarios" does not exist` | Lo mismo, en una versión del script anterior a la verificación previa |
