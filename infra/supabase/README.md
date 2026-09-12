# Scripts SQL para Supabase

Se ejecutan en **Supabase → SQL Editor**, en este orden y una sola vez por proyecto:

| Archivo | Qué hace | Cuándo |
|---|---|---|
| `01-storage.sql` | Crea los buckets privados `comprobantes` y `expedientes` y sus políticas RLS | Antes de la Etapa 2 (subida de comprobantes) |

Las tablas de la aplicación **no** se crean desde acá: las gestiona Prisma con
`pnpm --filter @gimenoos/api prisma:deploy`. Ver `docs/03-supabase.md`.
