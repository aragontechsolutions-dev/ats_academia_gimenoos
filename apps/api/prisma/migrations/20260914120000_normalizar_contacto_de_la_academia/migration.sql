-- Deja los datos de contacto de la academia como los guarda ahora la API.
--
-- Hasta este cambio, el telefono y el WhatsApp del negocio se guardaban tal cual
-- se escribian, mientras que los de alumnos e instructores se normalizaban a
-- `+598 98663201`. El resultado fue un WhatsApp guardado como `092331784`, que
-- es como se escribe un celular en Uruguay y que wa.me toma como un numero de
-- otro pais: el enlace se armaba igual y abria un chat con cualquiera.
--
-- Esta tabla tiene UNA sola fila por diseno (id fijo en 1), asi que esto arregla
-- lo que ya esta guardado y no vuelve a correr.

-- Numeros uruguayos escritos sin codigo de pais: se les antepone.
--
-- El guardarrail es doble: solo toca lo que NO empieza con `+` (un `+` significa
-- que quien lo cargo ya puso el codigo, incluso de otro pais) y solo cuando el
-- largo en digitos da para un numero uruguayo, con o sin el 0 de trunk y con o
-- sin el 598 adelante (8 a 11 digitos). Los ultimos 8 digitos son el numero.
UPDATE "configuracion_academia"
SET "telefono" = '+598 ' || right(regexp_replace("telefono", '\D', '', 'g'), 8)
WHERE "telefono" IS NOT NULL
  AND btrim("telefono") NOT LIKE '+%'
  AND length(regexp_replace("telefono", '\D', '', 'g')) BETWEEN 8 AND 11;

UPDATE "configuracion_academia"
SET "whatsapp" = '+598 ' || right(regexp_replace("whatsapp", '\D', '', 'g'), 8)
WHERE "whatsapp" IS NOT NULL
  AND btrim("whatsapp") NOT LIKE '+%'
  AND length(regexp_replace("whatsapp", '\D', '', 'g')) BETWEEN 8 AND 11;

-- El correo, en minuscula y sin espacios, igual que el de un alumno.
UPDATE "configuracion_academia"
SET "email" = lower(btrim("email"))
WHERE "email" IS NOT NULL AND "email" <> lower(btrim("email"));
