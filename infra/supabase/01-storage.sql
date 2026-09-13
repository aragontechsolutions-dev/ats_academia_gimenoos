-- ============================================================================
-- Buckets privados y politicas RLS de Supabase Storage
--
-- Ejecutar en: Supabase > SQL Editor, una sola vez por proyecto.
--
-- ORDEN IMPORTANTE: este script va DESPUES de aplicar las migraciones de
-- Prisma (`pnpm supabase:setup` o `pnpm prisma:deploy`). Necesita la tabla
-- `public.usuarios`, que crea Prisma, porque las politicas consultan el rol
-- del usuario. La verificacion de abajo lo comprueba y avisa si falta.
--
-- Se puede volver a ejecutar cuantas veces haga falta: no duplica nada.
--
-- Convencion de rutas: <usuarioId>/<recursoId>/<archivo>
-- El primer segmento de la ruta es SIEMPRE el UUID del usuario duenio del
-- archivo. Las politicas de abajo dependen de eso: si se cambia la convencion,
-- hay que cambiar las politicas.
-- ============================================================================

-- --- Verificacion previa ---------------------------------------------------
-- Sin esto, el script falla mas abajo con "relation public.usuarios does not
-- exist", un mensaje que no dice cual es el problema real ni como resolverlo.
DO $verificacion$
BEGIN
  IF to_regclass('public.usuarios') IS NULL THEN
    RAISE EXCEPTION E'Faltan las migraciones de la aplicacion.\n\n'
      'Este script necesita la tabla public.usuarios, que crea Prisma.\n'
      'Ejecuta primero, desde el repositorio:\n\n'
      '    cd apps/api && pnpm supabase:setup\n\n'
      'y volve a correr este script despues.';
  END IF;
END
$verificacion$;

-- --- Buckets ---------------------------------------------------------------
-- public = false: el archivo NO es accesible por URL directa. Se lee unicamente
-- con una signed URL de corta duracion generada por el backend.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprobantes', 'comprobantes', false,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expedientes', 'expedientes', false,
  5242880,  -- 5 MB: es el limite que exige la Intendencia para documentos digitales
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Fotos de egresados. Este bucket SI es publico, junto con el de vehiculos:
-- las fotos estan hechas para que las vea cualquiera que entre al sitio, sin
-- sesion. Publicarlas con signed URLs de corta duracion obligaria a la landing
-- a pedirle una URL al backend por cada foto de cada pagina, para proteger algo
-- que por definicion no es secreto.
--
-- Lo que SI se restringe es quien escribe: solo un administrador puede subir,
-- reemplazar o borrar. Ver las politicas mas abajo.
--
-- El limite de 3 MB es generoso: el panel reduce cada imagen a 1000 px antes de
-- subirla, asi que una foto normal pesa bastante menos.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'graduados', 'graduados', true,
  3145728,  -- 3 MB
  ARRAY['image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Fotos de los vehiculos de la flota. Mismo criterio que el de egresados:
-- publico para leer, solo administrador para escribir.
--
-- Por que publico: lo que se ve es un auto o una moto de la academia con su
-- matricula, que es informacion que cualquiera ve en la calle. Las rutas llevan
-- el UUID del vehiculo, asi que no se pueden adivinar, y dejarlo publico evita
-- pedirle una URL firmada al servidor por cada fila del listado.
--
-- El riesgo real de una foto no es quien la ve sino lo que trae adentro: la
-- ubicacion GPS del lugar donde se saco. Eso se resuelve antes de subirla, en el
-- navegador, que la vuelve a codificar y le borra los metadatos
-- (apps/admin/src/lib/imagen.ts).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehiculos', 'vehiculos', true,
  3145728,  -- 3 MB
  ARRAY['image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- --- Funcion auxiliar: quien es administrador ------------------------------
-- Lee el rol de la tabla `usuarios` (la misma fuente de verdad que usa la API),
-- no del JWT: asi revocar un rol tiene efecto inmediato tambien en Storage.
CREATE OR REPLACE FUNCTION public.es_administrador()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid() AND u.rol = 'ADMIN' AND u.activo
  );
$$;

-- --- Politicas RLS ---------------------------------------------------------
-- storage.objects ya tiene RLS habilitado en Supabase por defecto.

DROP POLICY IF EXISTS "duenio sube sus archivos" ON storage.objects;
CREATE POLICY "duenio sube sus archivos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('comprobantes', 'expedientes')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "duenio lee sus archivos" ON storage.objects;
CREATE POLICY "duenio lee sus archivos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('comprobantes', 'expedientes')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- El alumno puede reemplazar un archivo mal subido, pero NO borrarlo:
-- un comprobante ya verificado es parte del registro contable.
DROP POLICY IF EXISTS "duenio reemplaza sus archivos" ON storage.objects;
CREATE POLICY "duenio reemplaza sus archivos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('comprobantes', 'expedientes')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "administrador accede a todo" ON storage.objects;
CREATE POLICY "administrador accede a todo"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('comprobantes', 'expedientes') AND public.es_administrador())
  WITH CHECK (bucket_id IN ('comprobantes', 'expedientes') AND public.es_administrador());

-- --- Politicas de los buckets de fotos -------------------------------------
-- Valen para `graduados` y `vehiculos`, que se comportan igual.
--
-- Los nombres de politica cambiaron cuando se sumo el bucket de vehiculos. Estos
-- DROP sacan los anteriores: sin esto, un proyecto que ya habia corrido la
-- version vieja del script se quedaria con las dos versiones conviviendo.
DROP POLICY IF EXISTS "cualquiera ve las fotos de egresados" ON storage.objects;
DROP POLICY IF EXISTS "solo el administrador sube fotos de egresados" ON storage.objects;
DROP POLICY IF EXISTS "solo el administrador reemplaza fotos de egresados" ON storage.objects;
DROP POLICY IF EXISTS "solo el administrador borra fotos de egresados" ON storage.objects;

-- Leer: cualquiera, incluso sin sesion. Son buckets publicos y las fotos estan
-- para verse.
DROP POLICY IF EXISTS "cualquiera ve las fotos" ON storage.objects;
CREATE POLICY "cualquiera ve las fotos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id IN ('graduados', 'vehiculos'));

-- Escribir: solo un administrador. Sin esta politica, cualquier usuario con
-- sesion podria subir lo que quisiera a un bucket que el sitio publica.
DROP POLICY IF EXISTS "solo el administrador sube fotos" ON storage.objects;
CREATE POLICY "solo el administrador sube fotos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('graduados', 'vehiculos') AND public.es_administrador());

DROP POLICY IF EXISTS "solo el administrador reemplaza fotos" ON storage.objects;
CREATE POLICY "solo el administrador reemplaza fotos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('graduados', 'vehiculos') AND public.es_administrador())
  WITH CHECK (bucket_id IN ('graduados', 'vehiculos') AND public.es_administrador());

-- Borrar tiene que poder hacerse: si un egresado pide que saquen su foto, hay
-- que poder sacarla del Storage, no solo dejar de mostrarla.
DROP POLICY IF EXISTS "solo el administrador borra fotos" ON storage.objects;
CREATE POLICY "solo el administrador borra fotos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('graduados', 'vehiculos') AND public.es_administrador());

-- NOTA: el backend usa la clave service_role, que ignora RLS por diseño.
-- Estas politicas protegen los accesos hechos directamente desde el navegador
-- con la clave anonima. Son la segunda linea de defensa, no la unica.
