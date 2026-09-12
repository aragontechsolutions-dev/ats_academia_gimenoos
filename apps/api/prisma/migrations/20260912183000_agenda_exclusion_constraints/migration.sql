-- ============================================================================
-- Proteccion anti-doble-reserva a nivel de base de datos
--
-- Por que aca y no en el codigo: verificar "esta libre?" y despues insertar son
-- dos operaciones. Entre una y otra puede colarse otra peticion y quedar dos
-- clases pisadas sobre el mismo instructor o el mismo auto. Una EXCLUDE
-- constraint hace que Postgres rechace la segunda insercion sin importar cuantas
-- peticiones concurrentes haya, ni si alguien inserta a mano por SQL.
--
-- El rango se declara '[)' (inicio incluido, fin excluido) para que una clase
-- que termina 10:00 y otra que empieza 10:00 NO se consideren solapadas.
--
-- La clausula WHERE deja fuera las reservas canceladas, completadas y ausentes:
-- esos estados liberan el horario.
-- ============================================================================

-- btree_gist permite mezclar igualdad sobre uuid (=) con solapamiento de rangos (&&)
-- dentro de un mismo indice GiST. Sin esta extension las constraints de abajo fallan.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Coherencia basica del intervalo: el fin siempre despues del inicio.
ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_intervalo_valido" CHECK ("fin" > "inicio");

-- Un instructor no puede dictar dos clases a la vez.
ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_sin_solape_instructor"
  EXCLUDE USING gist (
    "instructor_id" WITH =,
    tstzrange("inicio", "fin", '[)') WITH &&
  )
  WHERE ("estado" IN ('PENDIENTE', 'CONFIRMADA'));

-- Un vehiculo no puede estar en dos clases a la vez.
-- Las reservas sin vehiculo asignado (vehiculo_id NULL) quedan fuera de la
-- restriccion, porque en GiST NULL no es igual a NULL.
ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_sin_solape_vehiculo"
  EXCLUDE USING gist (
    "vehiculo_id" WITH =,
    tstzrange("inicio", "fin", '[)') WITH &&
  )
  WHERE ("estado" IN ('PENDIENTE', 'CONFIRMADA'));

-- Un alumno tampoco puede tener dos clases superpuestas.
ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_sin_solape_cliente"
  EXCLUDE USING gist (
    "cliente_id" WITH =,
    tstzrange("inicio", "fin", '[)') WITH &&
  )
  WHERE ("estado" IN ('PENDIENTE', 'CONFIRMADA'));

-- Una excepcion de disponibilidad tampoco puede tener fin anterior al inicio.
ALTER TABLE "excepciones_disponibilidad"
  ADD CONSTRAINT "excepciones_intervalo_valido" CHECK ("fin" > "inicio");

-- La plantilla de disponibilidad usa minutos desde medianoche (0 a 1440).
ALTER TABLE "disponibilidad_plantillas"
  ADD CONSTRAINT "plantilla_rango_horario_valido"
  CHECK (
    "minuto_inicio" >= 0
    AND "minuto_fin" <= 1440
    AND "minuto_fin" > "minuto_inicio"
  );

ALTER TABLE "disponibilidad_plantillas"
  ADD CONSTRAINT "plantilla_dia_semana_valido" CHECK ("dia_semana" BETWEEN 0 AND 6);

-- Un pack no puede tener mas clases usadas que las compradas.
ALTER TABLE "compras_servicio"
  ADD CONSTRAINT "compra_clases_usadas_valido"
  CHECK ("clases_usadas" >= 0 AND "clases_usadas" <= "clases_totales");

-- Los importes nunca son negativos.
ALTER TABLE "pagos" ADD CONSTRAINT "pago_monto_no_negativo" CHECK ("monto" >= 0);
ALTER TABLE "servicios"
  ADD CONSTRAINT "servicio_precios_no_negativos"
  CHECK ("precio_contado" >= 0 AND "precio_tarjeta" >= 0);

-- La tabla de configuracion es de una sola fila.
ALTER TABLE "configuracion_academia" ADD CONSTRAINT "configuracion_fila_unica" CHECK ("id" = 1);
