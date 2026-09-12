# Verificaciones automáticas (CI)

Definición: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

## Cuándo corre

En cada **pull request contra `main`** y en cada **push a `main`**. Si se empuja
un commit nuevo al PR, la corrida anterior se cancela: no tiene sentido gastar
minutos verificando código ya reemplazado.

## Qué verifica

### 1. Tipos y compilación

- `pnpm typecheck` sobre los cinco paquetes.
- `pnpm build` de producción de las cuatro aplicaciones.

Antes genera el cliente de Prisma: sin eso los tipos de `@prisma/client` no
existen y el typecheck fallaría por una razón equivocada.

### 2. Migraciones y constraints de agenda

Levanta un PostgreSQL 16 real y:

- **Verifica que el esquema y las migraciones estén sincronizados**
  (`prisma migrate diff --exit-code`). Detecta el error más fácil de cometer:
  cambiar `schema.prisma` y olvidarse de generar la migración. Sin este control
  el desvío aparece recién al desplegar contra Supabase.
- **Aplica las migraciones** igual que en producción. Si una está rota, se ve acá.
- **Corre las pruebas de las constraints anti-doble-reserva**
  (`apps/api/test/agenda-constraints.spec.ts`, 11 casos).

> El chequeo de desvío usa una base auxiliar (`gimenoos_shadow`) porque
> `prisma migrate diff` **resetea** la base que reciba como shadow. Apuntarla a
> la de pruebas borraría los datos a mitad del job.

Esas pruebas protegen la invariante más importante del sistema: nadie puede
tomar un horario ya ocupado. Cubren solapamiento de instructor, de vehículo y de
alumno; clases consecutivas; liberación del horario al cancelar; y rechazo de
intervalos inválidos.

### 3. Control de secretos

- Ningún archivo `.env` versionado (salvo los `.env.example`).
- Ninguna clave de servicio ni cadena de conexión con contraseña real en el
  código.
- **Ninguna variable `VITE_*SERVICE_ROLE*`**: una variable `VITE_` termina dentro
  del JavaScript que descarga el visitante, y ahí nunca puede ir una clave que
  saltea RLS.

Los tres controles se probaron, incluida la prueba negativa: al introducir una
cadena de conexión con contraseña, el control la detecta y falla.

## Cómo hacer que bloqueen el merge

**Por defecto el CI informa pero no impide mergear.** Para que bloquee:

1. Settings → Branches → *Add branch protection rule*
2. Branch name pattern: `main`
3. Marcar:
   - *Require a pull request before merging*
   - *Require status checks to pass before merging* y seleccionar los tres:
     `Tipos y compilacion`, `Migraciones y constraints de agenda`,
     `Control de secretos`
   - *Require branches to be up to date before merging*

Los checks aparecen en la lista recién después de la primera corrida del
workflow.

## Reproducir el CI localmente

```bash
pnpm install --frozen-lockfile
pnpm --filter @gimenoos/api prisma:generate
pnpm typecheck
pnpm build

pnpm db:up
pnpm --filter @gimenoos/api prisma:deploy
pnpm --filter @gimenoos/api test
```

Correr esto antes de empujar evita el ciclo de "push, esperar, rojo, arreglar".

---

# Despliegue (CD)

**Destino elegido: Render para la API, Vercel para los tres frontends.**
El procedimiento completo está en [`09-despliegue.md`](09-despliegue.md).

| Pieza | Dónde | Se actualiza |
|---|---|---|
| `apps/api` | Render (Web Service, Node) | Con cada push a `main`; aplica las migraciones al arrancar |
| `apps/landing` | Vercel | Con cada push a `main` |
| `apps/admin` | Vercel | Con cada push a `main` |
| `apps/cliente` | Vercel | Con cada push a `main` |

Configuración versionada en el repositorio:

- `render.yaml` — blueprint de la API, con los secretos marcados `sync: false`
  para que se carguen en el panel y nunca en el repositorio.
- `vercel.json` — *fallback* de rutas para react-router, cacheo de assets,
  service worker sin caché y cabeceras de seguridad.

## Relación entre CI y despliegue

El CI corre sobre los **pull requests**; el despliegue ocurre al mergear a
`main`. Marcando los checks como obligatorios (ver más arriba), nada llega a
producción sin haber pasado tipos, compilación, migraciones y control de
secretos.

Las migraciones se aplican en el arranque del servicio: si una falla, el
servicio nuevo no levanta y Render sigue sirviendo la versión anterior.

## Lo que queda fuera del automatismo, a propósito

- **Los secretos** se cargan a mano en Render y Vercel: no viven en el
  repositorio.
- **`CORS_ORIGINS`** se completa después del primer despliegue de los
  frontends, cuando existen sus URLs.
- **El script de Storage** (`infra/supabase/01-storage.sql`) se ejecuta una vez
  en el SQL Editor de Supabase.
