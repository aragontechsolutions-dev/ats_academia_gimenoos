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

# Despliegue (CD) — pendiente de una decisión

**El despliegue automático todavía no está implementado, y es a propósito:**
depende de dónde se aloje cada pieza, y esa decisión no está tomada.

Lo que necesita cada parte:

| Pieza | Qué requiere |
|---|---|
| `apps/api` | Un contenedor Node con salida a internet y variables de entorno (incluida la `service_role`) |
| `apps/landing` | Hosting estático + CDN. Es lo que más impacta en el SEO local |
| `apps/admin` | Hosting estático, con `noindex` ya configurado |
| `apps/cliente` | Hosting estático servido por HTTPS (la PWA no instala sin HTTPS) |

Una vez elegido el destino, el CD se agrega como un workflow que corre **después**
de que el CI esté verde en `main`, con estas condiciones mínimas:

- Las migraciones se aplican con `prisma migrate deploy` **antes** de publicar la
  nueva versión de la API.
- Los secretos viajan como *GitHub Secrets*, nunca en el repositorio.
- El despliegue de producción requiere aprobación manual (*environment protection
  rule*), para que un merge no publique solo.

Ver el Bloque 6 de [`07-roadmap.md`](07-roadmap.md).
