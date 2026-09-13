-- Publicar la foto o el nombre de un egresado sin su autorizacion firmada es
-- una infraccion a la Ley 18.331, no un descuido de interfaz. Por eso la regla
-- vive en la base: ningun camino del codigo —ni un bug, ni una carga masiva, ni
-- una consulta a mano— puede saltearla.
ALTER TABLE "graduados"
  ADD CONSTRAINT "graduados_publicado_requiere_autorizacion"
  CHECK ("publicado" = false OR "autorizacion_at" IS NOT NULL);

-- Si firmo un tercero, tiene que constar quien: "autorizado por un tutor" sin
-- nombre no permite responder despues quien dio el consentimiento.
ALTER TABLE "graduados"
  ADD CONSTRAINT "graduados_tutor_requiere_firmante"
  CHECK ("autorizacion_es_tutor" = false OR "autorizacion_firmante" IS NOT NULL);

-- El ano tiene que ser el de la fecha de egreso. Esta desnormalizado para poder
-- filtrar e indexar barato, y sin esto se puede desincronizar en silencio.
ALTER TABLE "graduados"
  ADD CONSTRAINT "graduados_anio_coincide_con_fecha"
  CHECK ("anio" = EXTRACT(YEAR FROM "fecha_egreso"));
