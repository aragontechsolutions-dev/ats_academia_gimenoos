-- Por donde se le hizo llegar el acceso a la persona.
--
-- Hasta ahora el unico camino era el correo que manda Supabase. Se suma generar
-- el enlace sin mandar correo, para que la academia lo pegue en la conversacion
-- de WhatsApp que ya esta teniendo con esa persona.
--
-- El enlace EN SI no se guarda: es una credencial, y quien la tenga entra como
-- esa persona. Esta columna dice por donde salio, no que salio.

CREATE TYPE "CanalInvitacion" AS ENUM ('CORREO', 'ENLACE');

ALTER TABLE "invitaciones" ADD COLUMN "canal" "CanalInvitacion";

-- Las invitaciones que ya existen salieron por correo, que era lo unico que habia.
UPDATE "invitaciones" SET "canal" = 'CORREO' WHERE "enviada_at" IS NOT NULL;

-- Si se entrego, tiene que constar por donde. Y al reves: un canal sin fecha de
-- entrega seria un registro a medias que nadie sabria interpretar.
ALTER TABLE "invitaciones"
  ADD CONSTRAINT "invitaciones_canal_con_entrega"
  CHECK (("enviada_at" IS NULL) = ("canal" IS NULL));
