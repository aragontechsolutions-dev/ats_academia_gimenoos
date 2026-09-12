/**
 * Verificador de la conexion con Supabase.
 *
 * Comprueba, en orden, todo lo que tiene que estar bien antes de desarrollar
 * contra el proyecto real. Se ejecuta con:
 *
 *   cd apps/api && pnpm verificar
 *
 * No modifica nada: solo lee y reporta. Cada fallo indica que hacer.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let fallos = 0;

function ok(mensaje: string): void {
  console.log(`  \x1b[32mOK\x1b[0m    ${mensaje}`);
}

function error(mensaje: string, comoArreglarlo: string): void {
  fallos += 1;
  console.log(`  \x1b[31mFALLA\x1b[0m ${mensaje}`);
  console.log(`        → ${comoArreglarlo}`);
}

function aviso(mensaje: string): void {
  console.log(`  \x1b[33mAVISO\x1b[0m ${mensaje}`);
}

function seccion(titulo: string): void {
  console.log(`\n${titulo}`);
}

async function verificarVariables(): Promise<void> {
  seccion('1. Variables de entorno');

  const requeridas = ['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  for (const nombre of requeridas) {
    const valor = process.env[nombre];
    if (!valor) {
      error(`${nombre} no está definida`, 'Completala en apps/api/.env');
    } else if (valor.includes('<') || valor.includes('YOUR-PASSWORD')) {
      error(
        `${nombre} todavía tiene un placeholder sin reemplazar`,
        'Poné el valor real en apps/api/.env',
      );
    } else {
      ok(`${nombre} definida`);
    }
  }

  const pooler = process.env.DATABASE_URL ?? '';
  if (pooler.includes(':6543') && !pooler.includes('pgbouncer=true')) {
    error(
      'DATABASE_URL usa el pooler (6543) sin ?pgbouncer=true',
      'Agregá ?pgbouncer=true o Prisma abrirá conexiones que el pooler no soporta',
    );
  }

  const directa = process.env.DIRECT_URL ?? '';
  if (directa.includes(':6543')) {
    error(
      'DIRECT_URL apunta al puerto 6543 (transaction mode)',
      'Las migraciones necesitan el puerto 5432; si no, se cuelgan a la mitad',
    );
  }
}

async function verificarBase(): Promise<void> {
  seccion('2. Base de datos');

  try {
    await prisma.$queryRaw`SELECT 1`;
    ok('Conexión establecida');
  } catch (problema) {
    error(
      `No se pudo conectar: ${(problema as Error).message}`,
      'Revisá la contraseña y la región del host en DATABASE_URL',
    );
    return;
  }

  const extensiones = await prisma.$queryRaw<Array<{ extname: string }>>`
    SELECT extname FROM pg_extension WHERE extname = 'btree_gist'
  `;
  if (extensiones.length > 0) {
    ok('Extensión btree_gist instalada');
  } else {
    error(
      'Falta la extensión btree_gist',
      'La crea la migración; ejecutá pnpm prisma:deploy',
    );
  }

  const constraints = await prisma.$queryRaw<Array<{ conname: string }>>`
    SELECT conname FROM pg_constraint
    WHERE conname IN (
      'reservas_sin_solape_instructor',
      'reservas_sin_solape_vehiculo',
      'reservas_sin_solape_cliente'
    )
  `;
  if (constraints.length === 3) {
    ok('Las 3 constraints anti-doble-reserva están activas');
  } else {
    error(
      `Solo ${constraints.length} de 3 constraints anti-doble-reserva presentes`,
      'Ejecutá pnpm prisma:deploy. Sin ellas, dos alumnos pueden reservar el mismo horario',
    );
  }

  const servicios = await prisma.servicio.count();
  if (servicios > 0) {
    ok(`Catálogo con ${servicios} servicios`);
  } else {
    aviso('El catálogo está vacío: ejecutá pnpm prisma:seed');
  }

  const admins = await prisma.usuario.count({ where: { rol: 'ADMIN' } });
  if (admins > 0) {
    ok(`${admins} usuario(s) con rol ADMIN`);
  } else {
    aviso('No hay ningún ADMIN todavía. Ver el paso 7 de docs/03-supabase.md');
  }
}

async function verificarAuth(): Promise<void> {
  seccion('3. Autenticación');

  const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  if (!url) return;

  try {
    const respuesta = await fetch(`${url}/auth/v1/.well-known/jwks.json`);
    if (!respuesta.ok) {
      error(`El JWKS respondió ${respuesta.status}`, 'Revisá que SUPABASE_URL sea correcta');
      return;
    }

    const jwks = (await respuesta.json()) as { keys?: Array<{ alg?: string; kid?: string }> };
    const claves = jwks.keys ?? [];

    if (claves.length > 0) {
      ok(`JWKS publica ${claves.length} clave(s): ${claves.map((c) => c.alg).join(', ')}`);
      if (process.env.SUPABASE_JWT_LEGACY_SECRET) {
        aviso(
          'El proyecto usa claves asimétricas, pero SUPABASE_JWT_LEGACY_SECRET está configurada. ' +
            'Vaciala: aceptar HS256 sin necesidad amplía la superficie de ataque',
        );
      }
    } else {
      aviso('El JWKS está vacío: el proyecto todavía firma los tokens con el secreto heredado');
      if (!process.env.SUPABASE_JWT_LEGACY_SECRET) {
        error(
          'Sin claves asimétricas y sin SUPABASE_JWT_LEGACY_SECRET, ningún login va a funcionar',
          'Migrá a claves asimétricas en Authentication > JWT Keys, o poné el JWT Secret en esa variable',
        );
      } else {
        ok('SUPABASE_JWT_LEGACY_SECRET configurada como respaldo HS256');
      }
    }
  } catch (problema) {
    error(
      `No se pudo consultar el JWKS: ${(problema as Error).message}`,
      'Verificá que haya salida a internet hacia supabase.co',
    );
  }
}

async function verificarStorage(): Promise<void> {
  seccion('4. Storage');

  const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !clave) return;

  try {
    const respuesta = await fetch(`${url}/storage/v1/bucket`, {
      headers: { apikey: clave, Authorization: `Bearer ${clave}` },
    });
    if (!respuesta.ok) {
      error(`Storage respondió ${respuesta.status}`, 'Revisá SUPABASE_SERVICE_ROLE_KEY');
      return;
    }

    const buckets = (await respuesta.json()) as Array<{ name: string; public: boolean }>;
    for (const esperado of ['comprobantes', 'expedientes']) {
      const bucket = buckets.find((b) => b.name === esperado);
      if (!bucket) {
        aviso(`Falta el bucket "${esperado}": ejecutá infra/supabase/01-storage.sql`);
      } else if (bucket.public) {
        error(
          `El bucket "${esperado}" es PÚBLICO`,
          'Contiene cédulas y certificados médicos. Pasalo a privado ahora mismo',
        );
      } else {
        ok(`Bucket "${esperado}" existe y es privado`);
      }
    }
  } catch (problema) {
    error(`No se pudo consultar Storage: ${(problema as Error).message}`, 'Revisá la conectividad');
  }
}

async function main(): Promise<void> {
  console.log('\nVerificación de la conexión con Supabase');
  console.log('========================================');

  await verificarVariables();
  await verificarBase();
  await verificarAuth();
  await verificarStorage();

  console.log('');
  if (fallos === 0) {
    console.log('\x1b[32mTodo en orden.\x1b[0m Podés seguir con el desarrollo.\n');
  } else {
    console.log(`\x1b[31m${fallos} problema(s) a resolver.\x1b[0m Ver las indicaciones de arriba.\n`);
    process.exitCode = 1;
  }
}

main()
  .catch((problema) => {
    console.error(problema);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
