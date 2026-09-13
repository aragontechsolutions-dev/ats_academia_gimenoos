-- Coordenadas del local, para el mapa del sitio y el boton "llevame hasta alli".
ALTER TABLE "configuracion_academia"
  ADD COLUMN "latitud" DOUBLE PRECISION,
  ADD COLUMN "longitud" DOUBLE PRECISION;

-- Van las dos o ninguna. Con una sola no se puede dibujar nada, y el sitio
-- tendria que decidir en cada pantalla que hacer con media coordenada.
ALTER TABLE "configuracion_academia"
  ADD CONSTRAINT "configuracion_academia_coordenadas_completas"
  CHECK (("latitud" IS NULL) = ("longitud" IS NULL));

-- Fuera de rango no es un punto de la Tierra. La API ya lo valida; esto evita
-- que un dato imposible entre por cualquier otra via.
ALTER TABLE "configuracion_academia"
  ADD CONSTRAINT "configuracion_academia_coordenadas_en_rango"
  CHECK (
    ("latitud" IS NULL OR ("latitud" >= -90 AND "latitud" <= 90))
    AND ("longitud" IS NULL OR ("longitud" >= -180 AND "longitud" <= 180))
  );
