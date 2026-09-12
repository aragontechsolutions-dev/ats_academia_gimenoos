# Guía de desarrollo

## Requisitos

- Node.js ≥ 22
- pnpm 10
- Docker (para el Postgres local) o un PostgreSQL 16 instalado

## Puesta en marcha

```bash
git clone <repo> && cd ats_academia_gimenoos
pnpm install

# 1. Base de datos local
pnpm db:up                      # levanta Postgres 16 en el puerto 5433

# 2. Backend
cd apps/api
cp .env.example .env            # los valores por defecto apuntan al Postgres local
pnpm prisma:migrate             # crea el esquema
pnpm prisma:seed                # carga catálogo y configuración
cd ../..
pnpm api:dev                    # http://localhost:3000/api/v1
                                # documentación en /api/v1/docs

# 3. Frontends (cada uno en su terminal)
cd apps/landing && cp .env.example .env && cd ../.. && pnpm landing:dev  # :5173
cd apps/admin   && cp .env.example .env && cd ../.. && pnpm admin:dev    # :5174
cd apps/cliente && cp .env.example .env && cd ../.. && pnpm cliente:dev  # :5175
```

El panel y la PWA necesitan credenciales reales de Supabase para el login. La
landing funciona sin ellas.

> Si en tu máquina el puerto 5433 está ocupado, cambialo en `docker-compose.yml`
> **y** en las dos URLs de `apps/api/.env`.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm db:up` / `pnpm db:down` | Postgres local |
| `pnpm api:dev` | API en modo watch |
| `pnpm db:migrate` | Nueva migración a partir de cambios en el esquema |
| `pnpm db:generate` | Regenera el cliente de Prisma |
| `pnpm db:seed` | Datos iniciales (idempotente) |
| `pnpm build` | Compila todo el monorepo |
| `pnpm typecheck` | Verificación de tipos en todos los paquetes |

## Convenciones

### Idioma
**Todo el código en español**: entidades, campos, variables, funciones, rutas y
comentarios. El dominio es en español y traducir a medias produce cosas como
`bookingFecha`. Las únicas excepciones son las palabras reservadas y las APIs de
terceros.

Las tablas y columnas de la base van en `snake_case` mediante `@map` / `@@map`;
el código TypeScript usa `camelCase`.

### Comentarios
Explican **por qué**, no **qué**. Un comentario que repite lo que dice la línea
siguiente es ruido. Un comentario que explica por qué el rango es `'[)'` evita
que alguien lo "arregle" y rompa las clases consecutivas.

### Estructura del backend
Un módulo por dominio, con `controller` / `service` / `dto`. Los controladores
son finos: reciben, delegan y devuelven. La lógica va en los servicios.

### Nada sin usar
Si una función, variable, ruta o dependencia deja de usarse, se elimina en el
mismo cambio. El código muerto confunde y esconde errores.

### Fechas
Persistir siempre en UTC (`@db.Timestamptz(3)`). Convertir a
`America/Montevideo` solo al mostrar. Nunca guardar horas locales sin zona.

### Dinero
`Decimal(12,2)` en la base. Nunca `float`. Prisma serializa `Decimal` como
**string** en JSON: los frontends deben convertirlo explícitamente, no asumir
que llega un número.

## Flujo de trabajo con migraciones

1. Editar `apps/api/prisma/schema.prisma`.
2. `pnpm db:migrate` → Prisma genera el SQL y lo aplica.
3. Revisar el SQL generado **antes de commitearlo**.
4. Si hace falta SQL que Prisma no expresa (constraints `EXCLUDE`, índices
   parciales, funciones), crear la carpeta de migración a mano con su
   `migration.sql` y aplicarla con `pnpm db:migrate`.
5. Commitear el esquema **y** la migración juntos.

**Nunca** editar una migración ya aplicada en producción. Se crea una nueva.

## Antes de cada commit

- [ ] `pnpm typecheck` sin errores
- [ ] `pnpm build` sin errores
- [ ] Checklist de seguridad de `docs/02-seguridad.md` si se tocó algo sensible
- [ ] Documentación actualizada si cambió el comportamiento
- [ ] Ningún secreto en el diff (revisar `.env`, claves, tokens)

## Dónde está cada cosa

| Necesito… | Archivo |
|---|---|
| Cambiar textos o datos de la landing | `apps/landing/src/contenido.ts` |
| Agregar un endpoint | `apps/api/src/modules/<dominio>/` |
| Cambiar el modelo de datos | `apps/api/prisma/schema.prisma` + migración |
| Entender la agenda | `docs/01-modelo-datos.md` |
| Revisar seguridad | `docs/02-seguridad.md` |
| Conectar Supabase | `docs/03-supabase.md` |
| Saber qué sigue | `docs/04-plan-etapas.md` |
