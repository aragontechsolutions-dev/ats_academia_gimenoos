-- ============================================================================
-- Datos de prueba para el barrido de seguridad (scripts/qa-seguridad.mjs).
--
-- Crea cuatro cuentas —administracion, dos alumnas distintas y un instructor— y
-- una clase de cada alumno. Los dos alumnos son el punto: sin dos, no se puede
-- comprobar que uno NO llega a lo del otro, que es la mitad del barrido.
--
-- Los identificadores empiezan con `...-aa00-...` para no chocar con los de las
-- otras pruebas. Se puede volver a ejecutar cuantas veces haga falta.
--
-- DESPUES DE ESTO, generar los cuatro tokens. Con el secreto JWT local:
--
--   for n in 1:admin 2:ana 3:bruno 4:inst; do
--     node -e "...firmar un JWT con sub=00000000-0000-4000-aa00-00000000000<n>..."
--   done > t-qa-<nombre>.txt
--
-- El detalle esta en docs/27-auditoria-de-seguridad.md. Los archivos t-qa-*.txt
-- NO van al repositorio.
-- ============================================================================
BEGIN;
DELETE FROM reservas WHERE id IN ('00000000-0000-4000-aa00-000000000031','00000000-0000-4000-aa00-000000000032');
DELETE FROM clientes WHERE id IN ('00000000-0000-4000-aa00-00000000000a','00000000-0000-4000-aa00-00000000000b');
DELETE FROM instructores WHERE id = '00000000-0000-4000-aa00-0000000000e1';
DELETE FROM vehiculos WHERE id = '00000000-0000-4000-aa00-0000000000f1';
DELETE FROM usuarios WHERE id IN (
  '00000000-0000-4000-aa00-000000000001','00000000-0000-4000-aa00-000000000002',
  '00000000-0000-4000-aa00-000000000003','00000000-0000-4000-aa00-000000000004');

INSERT INTO usuarios (id, email, nombre, apellido, rol, activo, created_at, updated_at) VALUES
  ('00000000-0000-4000-aa00-000000000001','qa-admin@local','Qa','Admin','ADMIN',true,now(),now()),
  ('00000000-0000-4000-aa00-000000000002','qa-ana@local','Ana','Alumna','CLIENTE',true,now(),now()),
  ('00000000-0000-4000-aa00-000000000003','qa-bruno@local','Bruno','Alumno','CLIENTE',true,now(),now()),
  ('00000000-0000-4000-aa00-000000000004','qa-inst@local','Ivo','Instructor','INSTRUCTOR',true,now(),now());

INSERT INTO clientes (id, usuario_id, nombre, apellido, telefono, documento, notas_internas, ciudad, activo, created_at, updated_at) VALUES
  ('00000000-0000-4000-aa00-00000000000a','00000000-0000-4000-aa00-000000000002','Ana','Alumna','+598 91111111','11111111','NOTA INTERNA DE ANA: no debe verla ella','San Carlos',true,now(),now()),
  ('00000000-0000-4000-aa00-00000000000b','00000000-0000-4000-aa00-000000000003','Bruno','Alumno','+598 92222222','22222222','NOTA INTERNA DE BRUNO','San Carlos',true,now(),now());

INSERT INTO instructores (id, usuario_id, nombre, apellido, habilita_auto, habilita_moto, activo, created_at, updated_at) VALUES
  ('00000000-0000-4000-aa00-0000000000e1','00000000-0000-4000-aa00-000000000004','Ivo','Instructor',true,false,true,now(),now());

INSERT INTO vehiculos (id, patente, tipo, estado, created_at, updated_at) VALUES
  ('00000000-0000-4000-aa00-0000000000f1','QAA1234','AUTO','ACTIVO',now(),now());

-- Una clase de Ana y otra de Bruno, para los intentos de acceso cruzado.
INSERT INTO reservas (id, cliente_id, instructor_id, vehiculo_id, tipo, inicio, fin, estado, nota_instructor, observaciones, created_at, updated_at) VALUES
  ('00000000-0000-4000-aa00-000000000031','00000000-0000-4000-aa00-00000000000a','00000000-0000-4000-aa00-0000000000e1','00000000-0000-4000-aa00-0000000000f1','AUTO', now() + interval '5 days', now() + interval '5 days 45 minutes','CONFIRMADA','NOTA DEL INSTRUCTOR SOBRE ANA','obs',now(),now()),
  ('00000000-0000-4000-aa00-000000000032','00000000-0000-4000-aa00-00000000000b','00000000-0000-4000-aa00-0000000000e1','00000000-0000-4000-aa00-0000000000f1','AUTO', now() + interval '6 days', now() + interval '6 days 45 minutes','CONFIRMADA','NOTA SOBRE BRUNO','obs',now(),now());
COMMIT;
