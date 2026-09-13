-- Invitaciones: la unica puerta de entrada al sistema.
--
-- Hasta ahora, un token valido de Supabase alcanzaba para que la API creara la
-- cuenta local, y la ficha de alumno se adivinaba por correo despues del hecho.
-- Con esto el vinculo queda dicho de antemano.

CREATE TYPE "EstadoInvitacion" AS ENUM ('PENDIENTE', 'ACEPTADA', 'REVOCADA');

CREATE TABLE "invitaciones" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "email"         TEXT NOT NULL,
  "rol"           "RolUsuario" NOT NULL DEFAULT 'CLIENTE',
  "estado"        "EstadoInvitacion" NOT NULL DEFAULT 'PENDIENTE',
  "cliente_id"    UUID,
  "instructor_id" UUID,
  "enviada_at"    TIMESTAMPTZ(3),
  "aceptada_at"   TIMESTAMPTZ(3),
  "aceptada_por"  UUID,
  "invitada_por"  UUID,
  "created_at"    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "invitaciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invitaciones_email_estado_idx" ON "invitaciones" ("email", "estado");
CREATE INDEX "invitaciones_cliente_id_idx" ON "invitaciones" ("cliente_id");
CREATE INDEX "invitaciones_instructor_id_idx" ON "invitaciones" ("instructor_id");

ALTER TABLE "invitaciones"
  ADD CONSTRAINT "invitaciones_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invitaciones"
  ADD CONSTRAINT "invitaciones_instructor_id_fkey"
  FOREIGN KEY ("instructor_id") REFERENCES "instructores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --- Reglas que la base hace cumplir, no solo el codigo -------------------

-- El correo se guarda siempre en minuscula. Supabase normaliza los correos, asi
-- que si aca entrara "Juan@X.com" la busqueda del ingreso no lo encontraria
-- nunca y la invitacion no serviria para nada, sin ningun error visible.
ALTER TABLE "invitaciones"
  ADD CONSTRAINT "invitaciones_email_en_minuscula"
  CHECK ("email" = lower("email") AND "email" <> '');

-- Una invitacion pertenece como mucho a una ficha. Las dos a la vez no
-- significa nada y dejaria el vinculo del ingreso sin decidir.
ALTER TABLE "invitaciones"
  ADD CONSTRAINT "invitaciones_una_sola_ficha"
  CHECK (NOT ("cliente_id" IS NOT NULL AND "instructor_id" IS NOT NULL));

-- Un alumno o instructor invitado tiene que traer su ficha; un ADMIN no tiene.
ALTER TABLE "invitaciones"
  ADD CONSTRAINT "invitaciones_ficha_segun_rol"
  CHECK (
    ("rol" = 'CLIENTE'    AND "instructor_id" IS NULL) OR
    ("rol" = 'INSTRUCTOR' AND "cliente_id" IS NULL)    OR
    ("rol" = 'ADMIN'      AND "cliente_id" IS NULL AND "instructor_id" IS NULL)
  );

-- Una sola invitacion pendiente por correo. Sin esto, invitar dos veces al mismo
-- alumno dejaria dos filas y el ingreso tomaria cualquiera de las dos, que es
-- justo la ambiguedad que esta tabla viene a eliminar.
-- Es un indice PARCIAL: las aceptadas y revocadas se acumulan sin molestar,
-- porque son el historial.
CREATE UNIQUE INDEX "invitaciones_una_pendiente_por_email"
  ON "invitaciones" ("email")
  WHERE "estado" = 'PENDIENTE';

-- Una invitacion aceptada tiene que decir cuando y por quien.
ALTER TABLE "invitaciones"
  ADD CONSTRAINT "invitaciones_aceptada_completa"
  CHECK (
    "estado" <> 'ACEPTADA' OR ("aceptada_at" IS NOT NULL AND "aceptada_por" IS NOT NULL)
  );
