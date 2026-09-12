# Configuración de Supabase

Guía paso a paso para conectar el sistema a un proyecto de Supabase.

## 1. Crear el proyecto

En [supabase.com](https://supabase.com), proyecto nuevo:

- **Región**: la más cercana a Uruguay disponible (habitualmente `sa-east-1`,
  São Paulo). Reduce la latencia de cada consulta.
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
cp .env.example .env     # y completar con los valores de arriba
pnpm prisma:deploy       # aplica las migraciones ya versionadas
pnpm prisma:seed         # carga catálogo y configuración inicial
```

`prisma:deploy` (y no `prisma:migrate`) es lo que se usa contra Supabase:
aplica las migraciones existentes sin intentar generar nuevas ni tocar una
shadow database.

La extensión `btree_gist`, necesaria para las constraints de agenda, la crea la
propia migración.

## 4. Configurar Storage

En **SQL Editor**, ejecutar `infra/supabase/01-storage.sql`. Crea los buckets
privados `comprobantes` y `expedientes` con sus políticas RLS.

Verificar después en **Storage** que ambos figuren como *Private*.

## 5. Configurar Auth

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

En **Authentication → JWT Keys**, migrar a claves asimétricas (ES256) si el
proyecto todavía usa el secreto compartido. Con eso, `SUPABASE_JWT_LEGACY_SECRET`
queda vacía y la API verifica los tokens contra el JWKS público.

Si el proyecto aún no migró, poner el secreto heredado en esa variable: la API
acepta HS256 como respaldo y deja un aviso en el log.

## 6. Crear el primer administrador

El sistema aprovisiona el usuario local en su primer acceso, con rol `CLIENTE`
por defecto. Para el primer administrador:

1. **Authentication → Users → Add user**, con correo y contraseña.
2. Que ingrese una vez al panel (así se crea la fila en `usuarios`).
3. En **SQL Editor**:

```sql
UPDATE usuarios SET rol = 'ADMIN' WHERE email = 'correo@delAdmin.com';
```

A partir de ahí los roles se administran desde el panel (Etapa 1).

> Alternativa: fijar `app_metadata.rol = 'ADMIN'` desde el panel de Supabase
> antes del primer ingreso. `app_metadata` solo se escribe con la clave
> `service_role`, nunca por el propio usuario.

## 7. Checklist antes de producción

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
