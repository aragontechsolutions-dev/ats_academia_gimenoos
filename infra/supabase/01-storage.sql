-- ============================================================================
-- Buckets privados y politicas RLS de Supabase Storage
--
-- Ejecutar en: Supabase > SQL Editor, una sola vez por proyecto.
--
-- Convencion de rutas: <usuarioId>/<recursoId>/<archivo>
-- El primer segmento de la ruta es SIEMPRE el UUID del usuario duenio del
-- archivo. Las politicas de abajo dependen de eso: si se cambia la convencion,
-- hay que cambiar las politicas.
-- ============================================================================

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

-- NOTA: el backend usa la clave service_role, que ignora RLS por diseño.
-- Estas politicas protegen los accesos hechos directamente desde el navegador
-- con la clave anonima. Son la segunda linea de defensa, no la unica.
