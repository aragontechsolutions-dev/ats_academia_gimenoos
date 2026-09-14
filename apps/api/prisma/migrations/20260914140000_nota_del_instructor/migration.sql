-- Como fue la clase, escrito por el instructor que la dio.
--
-- Es una columna aparte de `observaciones` a proposito: esa la escribe la
-- academia al agendar y el alumno la ve en su app. Esta es para la academia y
-- para la proxima clase, y el alumno NO la recibe: la API elige los campos segun
-- el rol de quien consulta.
ALTER TABLE "reservas" ADD COLUMN "nota_instructor" TEXT;
