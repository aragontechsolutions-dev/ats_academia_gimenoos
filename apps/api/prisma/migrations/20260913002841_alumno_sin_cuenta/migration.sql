-- ============================================================================
-- El alumno deja de depender de tener cuenta en el sistema
--
-- Antes, `clientes` exigia un `usuario_id`: no se podia registrar a alguien que
-- se anota en el local y nunca inicia sesion, que es el caso mas comun en una
-- academia. Ademas el nombre y el contacto vivian en `usuarios`, pensada para
-- credenciales de acceso.
--
-- A partir de aca:
--   Cliente = el alumno (entidad del negocio, con sus datos de contacto)
--   Usuario = la credencial de acceso (opcional)
--
-- Las columnas nuevas se agregan primero como opcionales y se rellenan desde
-- `usuarios` antes de volverse obligatorias. Agregarlas directamente como NOT
-- NULL falla si la tabla ya tiene filas, y en produccion puede tenerlas.
-- ============================================================================

-- --- 1. Columnas nuevas, todavia opcionales --------------------------------
ALTER TABLE "clientes"
  ADD COLUMN "nombre"   TEXT,
  ADD COLUMN "apellido" TEXT,
  ADD COLUMN "telefono" TEXT,
  ADD COLUMN "email"    TEXT,
  ADD COLUMN "activo"   BOOLEAN NOT NULL DEFAULT true;

-- --- 2. Se traen los datos de la cuenta asociada ----------------------------
UPDATE "clientes" c
SET "nombre"   = COALESCE(NULLIF(u."nombre", ''), 'Sin nombre'),
    "apellido" = COALESCE(NULLIF(u."apellido", ''), 'Sin apellido'),
    "telefono" = u."telefono",
    "email"    = u."email"
FROM "usuarios" u
WHERE u."id" = c."usuario_id";

-- Red de seguridad por si quedara alguna ficha sin cuenta asociada.
UPDATE "clientes"
SET "nombre"   = COALESCE("nombre", 'Sin nombre'),
    "apellido" = COALESCE("apellido", 'Sin apellido');

-- --- 3. Ahora si, obligatorias ---------------------------------------------
ALTER TABLE "clientes"
  ALTER COLUMN "nombre"   SET NOT NULL,
  ALTER COLUMN "apellido" SET NOT NULL;

-- --- 4. La cuenta pasa a ser opcional --------------------------------------
-- SET NULL y no CASCADE: borrar una cuenta no debe borrar al alumno ni su
-- historial de clases y pagos.
ALTER TABLE "clientes" DROP CONSTRAINT "clientes_usuario_id_fkey";
ALTER TABLE "clientes" ALTER COLUMN "usuario_id" DROP NOT NULL;
ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- --- 5. Indices de busqueda ------------------------------------------------
-- Por apellido y nombre: es como se busca un alumno en el panel.
-- Por email: es la clave con la que se vincula la ficha cuando el alumno se
-- crea una cuenta mas adelante.
CREATE INDEX "clientes_apellido_nombre_idx" ON "clientes"("apellido", "nombre");
CREATE INDEX "clientes_email_idx" ON "clientes"("email");
