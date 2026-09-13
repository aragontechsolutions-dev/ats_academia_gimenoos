-- Los telefonos cargados hasta ahora se guardaron tal cual los escribieron:
-- "098663201", "098 663 201", "+59898663201". A partir de esta version la API
-- los normaliza a "+598 98663201", pero los que ya estaban quedarian con el
-- formato viejo y el mismo numero seguiria figurando de varias formas.
--
-- Esta migracion aplica la misma regla a lo que ya existe. Solo toca los que
-- reconoce como uruguayos: cualquier otro se deja como esta, porque cambiarlo
-- a ciegas es peor que dejarlo con formato viejo.

-- Paso 1: quedarse con los digitos.
WITH limpiados AS (
  SELECT id,
         regexp_replace(telefono, '\D', '', 'g') AS digitos,
         telefono LIKE '+%' AS tenia_mas
  FROM clientes
  WHERE telefono IS NOT NULL AND telefono <> ''
),
-- Paso 2: sacar el codigo de pais y el 0 de trunk, que son dos formas de
-- escribir lo mismo. Los que ya traen otro codigo de pais no se tocan.
nacionales AS (
  SELECT id,
         CASE
           WHEN digitos LIKE '598%' THEN regexp_replace(substring(digitos from 4), '^0+', '')
           WHEN tenia_mas THEN NULL
           ELSE regexp_replace(digitos, '^0+', '')
         END AS nacional
  FROM limpiados
)
UPDATE clientes c
SET telefono = '+598 ' || n.nacional
FROM nacionales n
WHERE c.id = n.id
  AND n.nacional ~ '^\d{8}$';

-- Lo mismo para los instructores.
WITH limpiados AS (
  SELECT id,
         regexp_replace(telefono, '\D', '', 'g') AS digitos,
         telefono LIKE '+%' AS tenia_mas
  FROM instructores
  WHERE telefono IS NOT NULL AND telefono <> ''
),
nacionales AS (
  SELECT id,
         CASE
           WHEN digitos LIKE '598%' THEN regexp_replace(substring(digitos from 4), '^0+', '')
           WHEN tenia_mas THEN NULL
           ELSE regexp_replace(digitos, '^0+', '')
         END AS nacional
  FROM limpiados
)
UPDATE instructores i
SET telefono = '+598 ' || n.nacional
FROM nacionales n
WHERE i.id = n.id
  AND n.nacional ~ '^\d{8}$';
