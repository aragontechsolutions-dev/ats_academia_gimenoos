-- Un alumno extranjero puede sacar la libreta con su pasaporte, asi que la
-- cedula deja de ser el unico documento posible.

CREATE TYPE "TipoIdentificacion" AS ENUM ('CEDULA', 'PASAPORTE');

-- RENAME y no DROP + ADD: las cedulas ya cargadas se conservan. Prisma genera
-- un borrado y un alta para los renombres, que vaciaria la columna en silencio.
ALTER TABLE "clientes" RENAME COLUMN "cedula" TO "documento";

-- Las filas existentes son todas cedulas uruguayas, que es lo que habia hasta
-- ahora: por eso los valores por defecto son CEDULA y UY.
ALTER TABLE "clientes"
  ADD COLUMN "tipo_documento" "TipoIdentificacion" NOT NULL DEFAULT 'CEDULA',
  ADD COLUMN "pais_documento" CHAR(2) NOT NULL DEFAULT 'UY';

-- La unicidad pasa a ser por (tipo, pais, numero). Dos personas de paises
-- distintos pueden tener el mismo numero de pasaporte, asi que el numero solo
-- no alcanza para identificar a nadie.
-- `@unique` de Prisma crea un INDICE, no una constraint de tabla: se borra con
-- DROP INDEX. (ALTER TABLE ... DROP CONSTRAINT falla con "does not exist".)
DROP INDEX IF EXISTS "clientes_cedula_key";

CREATE UNIQUE INDEX "clientes_tipo_documento_pais_documento_documento_key"
  ON "clientes" ("tipo_documento", "pais_documento", "documento");

-- Un pasaporte sin pais emisor no identifica a nadie, y una cedula uruguaya
-- emitida por otro pais no existe. La regla vive en la base para que ningun
-- camino del codigo pueda dejar una ficha a medias.
ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_cedula_es_uruguaya"
  CHECK ("tipo_documento" <> 'CEDULA' OR "pais_documento" = 'UY');

-- La cedula uruguaya son solo digitos; el pasaporte, letras y digitos en
-- mayusculas. Sin esto, un numero con puntos o espacios entra igual por
-- cualquier via que no pase por la API.
ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_documento_formato"
  CHECK (
    "documento" IS NULL
    OR ("tipo_documento" = 'CEDULA' AND "documento" ~ '^[0-9]{7,8}$')
    OR ("tipo_documento" = 'PASAPORTE' AND "documento" ~ '^[A-Z0-9]{5,20}$')
  );
