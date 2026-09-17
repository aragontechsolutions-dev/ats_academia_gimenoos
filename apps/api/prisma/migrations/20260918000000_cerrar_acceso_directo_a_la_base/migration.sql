-- ============================================================================
-- Cerrar el acceso directo a la base desde el navegador.
--
-- EL PROBLEMA QUE RESUELVE
--
-- Supabase publica automaticamente cada tabla del esquema `public` a traves de
-- PostgREST, en https://<proyecto>.supabase.co/rest/v1/<tabla>. Y la clave
-- anonima esta —necesariamente— dentro del codigo de las tres aplicaciones,
-- porque hace falta para el login.
--
-- Al crear las tablas con Prisma quedan dos cosas por omision:
--
--   1. SIN RLS. Sin politicas de fila, no hay nada que filtre quien ve que.
--   2. CON PERMISOS para los roles `anon` y `authenticated`, porque Supabase
--      define privilegios por defecto sobre el esquema `public`.
--
-- Las dos juntas significan que cualquiera que saque la clave anonima del
-- navegador —mirar el codigo fuente de la pagina alcanza— puede leer y escribir
-- las tablas directamente, sin pasar por la API: cedulas, telefonos,
-- direcciones, correos, invitaciones y la auditoria entera.
--
-- LA SOLUCION, EN TRES CAPAS
--
--   1. RLS activado en todas las tablas, SIN politicas. Sin politicas, RLS
--      niega todo. Es lo correcto: nadie tiene que llegar a estas tablas desde
--      el navegador.
--   2. Permisos revocados a `anon` y `authenticated`. Es la capa que de verdad
--      cierra la puerta; RLS queda como segunda linea por si algun dia se
--      agrega una politica sin querer.
--   3. Privilegios por defecto corregidos, para que las tablas que se creen
--      MAS ADELANTE no nazcan abiertas otra vez.
--
-- POR QUE ESTO NO ROMPE NADA
--
--   - La API no pasa por PostgREST: se conecta por Postgres con el rol duenio
--     de las tablas, y el duenio ignora RLS (no se usa FORCE ROW LEVEL SECURITY).
--   - Las politicas de Storage consultan `public.usuarios` a traves de
--     `public.es_administrador()`, que es SECURITY DEFINER: corre con los
--     permisos de su duenio y no con los de quien la llama. Por eso sigue
--     funcionando aunque `authenticated` ya no pueda leer esa tabla.
--   - Los frontends solo usan Supabase para autenticarse (esquema `auth`), que
--     esto no toca.
--
-- Se puede volver a ejecutar cuantas veces haga falta.
-- Ver docs/26-cierre-de-la-base.md.
-- ============================================================================

-- --- 1 y 2: RLS y permisos, tabla por tabla --------------------------------
DO $cerrar$
DECLARE
  fila record;
  hay_anon boolean;
  hay_authenticated boolean;
BEGIN
  -- En una instalacion local no existen los roles de Supabase. El script tiene
  -- que correr igual: es la misma base que despues se despliega.
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') INTO hay_anon;
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') INTO hay_authenticated;

  FOR fila IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', fila.tablename);

    IF hay_anon THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', fila.tablename);
    END IF;
    IF hay_authenticated THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', fila.tablename);
    END IF;
  END LOOP;

  -- Las secuencias filtran menos, pero filtran: el valor de una secuencia dice
  -- cuantas filas tiene una tabla.
  FOR fila IN
    SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
  LOOP
    IF hay_anon THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon', fila.sequencename);
    END IF;
    IF hay_authenticated THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM authenticated', fila.sequencename);
    END IF;
  END LOOP;
END
$cerrar$;

-- --- 3: que las tablas futuras no nazcan abiertas ---------------------------
--
-- `ALTER DEFAULT PRIVILEGES` se aplica por rol que crea los objetos. Supabase
-- concede permisos por defecto sobre el esquema `public` al rol que corre las
-- migraciones; esto lo deshace para ese mismo rol.
--
-- Sin esto, la proxima migracion de Prisma crea una tabla abierta y el arreglo
-- de arriba queda desactualizado en silencio.
DO $futuras$
DECLARE
  duenio text := current_user;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon',
      duenio
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon',
      duenio
    );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated',
      duenio
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated',
      duenio
    );
  END IF;
END
$futuras$;
