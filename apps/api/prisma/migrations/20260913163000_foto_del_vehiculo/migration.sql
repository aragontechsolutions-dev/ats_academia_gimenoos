-- Foto de cada vehiculo de la flota.
--
-- Guarda la RUTA dentro del bucket `vehiculos` de Storage (`<id>/<archivo>.jpg`),
-- no una direccion completa: la direccion publica se arma a partir de la ruta.
-- La forma exacta la valida el DTO (ver apps/api/src/common/formato/foto.ts).
--
-- Nullable a proposito: los vehiculos ya cargados no tienen foto y seguir
-- funcionando sin una es lo normal.
ALTER TABLE "vehiculos" ADD COLUMN "foto_ruta" TEXT;
