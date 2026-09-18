/**
 * La base no se puede tocar desde el navegador.
 *
 * Supabase publica cada tabla del esquema `public` por PostgREST, y la clave
 * anónima está dentro del código de las tres aplicaciones porque hace falta para
 * el login. Si una tabla queda sin RLS y con permisos, cualquiera que mire el
 * código fuente de la página puede leerla entera.
 *
 * Esta prueba existe para que eso no vuelva a pasar **por olvido**: una tabla
 * nueva sin RLS hace fallar el pull request en vez de llegar a producción
 * abierta.
 */
import { PrismaService } from '../src/common/prisma/prisma.service';

const prisma = new PrismaService();

beforeAll(() => prisma.$connect());
afterAll(() => prisma.$disconnect());

/**
 * Tablas que pueden quedar sin RLS, con el motivo escrito.
 *
 * Está vacía a propósito. Si alguna vez hay que agregar una, el motivo tiene que
 * caber en un renglón y convencer a quien revise el pull request.
 */
const SIN_RLS_A_PROPOSITO: string[] = [];

describe('Todas las tablas tienen RLS', () => {
  it('ninguna tabla del esquema público quedó abierta', async () => {
    const abiertas = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND NOT rowsecurity
      ORDER BY tablename
    `;

    const inesperadas = abiertas
      .map((t) => t.tablename)
      .filter((t) => !SIN_RLS_A_PROPOSITO.includes(t));

    expect(inesperadas).toEqual([]);
  });

  it('y hay tablas de verdad: la prueba no pasa por mirar una lista vacía', async () => {
    // Sin esto, un `pg_tables` que no devuelva nada —otro esquema, otra base—
    // haría pasar la prueba de arriba sin haber comprobado nada.
    const [fila] = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT count(*) AS total FROM pg_tables WHERE schemaname = 'public'
    `;
    expect(Number(fila!.total)).toBeGreaterThan(15);
  });
});

describe('Un rol sin permisos no puede leer nada', () => {
  /**
   * Se comprueba de verdad y no leyendo una lista de configuración.
   *
   * Se crea un rol que imita a `anon` —existe y ve el esquema, nada más— y se
   * pregunta por sus permisos reales tabla por tabla. Es lo más cerca que se
   * puede estar de lo que haría alguien con la clave anónima, sin depender de
   * tener Supabase delante.
   */
  const ROL = 'anon_de_prueba_jest';

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${ROL}`).catch(() => undefined);
    await prisma.$executeRawUnsafe(`CREATE ROLE ${ROL} NOLOGIN`);
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${ROL}`);
  });

  afterAll(async () => {
    await prisma
      .$executeRawUnsafe(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${ROL}`)
      .catch(() => undefined);
    await prisma.$executeRawUnsafe(`REVOKE ALL ON SCHEMA public FROM ${ROL}`).catch(() => undefined);
    await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${ROL}`).catch(() => undefined);
  });

  const CONFIDENCIALES = [
    'clientes',
    'usuarios',
    'instructores',
    'reservas',
    'invitaciones',
    'pagos',
    'registros_auditoria',
    'suscripciones_push',
    'expedientes',
    'documentos_expediente',
    'avisos_telegram',
  ];

  it.each(CONFIDENCIALES)('no tiene permiso de lectura sobre %s', async (tabla) => {
    const [fila] = await prisma.$queryRawUnsafe<Array<{ puede: boolean }>>(
      `SELECT has_table_privilege('${ROL}', 'public.${tabla}', 'SELECT') AS puede`,
    );
    expect(fila!.puede).toBe(false);
  });

  it('tampoco de escritura, en ninguna tabla del esquema', async () => {
    // Se pasa el OID y no el nombre. Con el nombre, Postgres puede evaluar
    // `has_table_privilege` ANTES del filtro por esquema, y falla al resolver
    // «public.pg_statistic», que no existe. Con el OID no hay nada que resolver.
    const escribibles = await prisma.$queryRawUnsafe<Array<{ tabla: string }>>(
      `SELECT c.relname AS tabla
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND (has_table_privilege('${ROL}', c.oid, 'INSERT')
            OR has_table_privilege('${ROL}', c.oid, 'UPDATE')
            OR has_table_privilege('${ROL}', c.oid, 'DELETE'))`,
    );
    expect(escribibles.map((t) => t.tabla)).toEqual([]);
  });
});
