/**
 * Las políticas del bucket de comprobantes.
 *
 * Es lo único que separa el documento bancario de un alumno del de otro. La
 * regla vive en `infra/supabase/01-storage.sql` y la aplica Supabase, que desde
 * acá no se alcanza. Lo que sí se puede comprobar —y es lo que importa— son las
 * tres cosas de las que depende que funcione:
 *
 *  1. Que la regla escrita sea la que creemos. Si alguien la afloja, esto falla.
 *  2. Que esa regla, ejecutada en Postgres, haga lo que se espera: el dueño ve
 *     lo suyo y NADIE ve lo del otro.
 *  3. Que la carpeta donde la API guarda el archivo sea la misma que exige la
 *     regla. Este es el invariante silencioso: la regla pide
 *     `auth.uid()`, y la API compone la ruta con el id de la fila `usuarios`.
 *     Funciona porque son el mismo valor. El día que dejen de serlo, ningún
 *     error lo diría: las subidas seguirían andando y los comprobantes
 *     quedarían inalcanzables.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaService } from '../src/common/prisma/prisma.service';
import { UsuariosService } from '../src/modules/usuarios/usuarios.service';
import type { SupabaseJwtPayload } from '../src/common/auth/jwt-payload.interface';

const prisma = new PrismaService();
const SQL = readFileSync(join(__dirname, '..', '..', '..', 'infra', 'supabase', '01-storage.sql'), 'utf8');

beforeAll(() => prisma.$connect());
afterAll(() => prisma.$disconnect());

describe('1. La regla escrita es la que creemos', () => {
  it('el bucket de comprobantes es privado', () => {
    expect(SQL).toMatch(/'comprobantes',\s*'comprobantes',\s*false/);
  });

  it('solo acepta PDF, JPEG y PNG: nada que el navegador pueda ejecutar', () => {
    const bloque = SQL.slice(SQL.indexOf("'comprobantes', 'comprobantes'"));
    const tipos = bloque.slice(0, 400).match(/ARRAY\[([^\]]+)\]/)?.[1] ?? '';
    expect(tipos).toContain('application/pdf');
    expect(tipos).toContain('image/jpeg');
    expect(tipos).toContain('image/png');
    // SVG es una imagen que puede traer <script> adentro.
    expect(tipos).not.toContain('svg');
    expect(tipos).not.toContain('text/html');
  });

  it('leer un archivo exige que la primera carpeta sea la de quien pide', () => {
    const politica = SQL.slice(SQL.indexOf('"duenio lee sus archivos"'));
    expect(politica.slice(0, 400)).toContain("(storage.foldername(name))[1] = auth.uid()::text");
  });

  it('NO hay una política que deje borrar al alumno', () => {
    // Un comprobante ya verificado es parte del registro contable. El alumno
    // puede reemplazarlo, no hacerlo desaparecer.
    expect(SQL).not.toMatch(/CREATE POLICY[^;]*FOR DELETE TO authenticated[^;]*comprobantes/s);
  });

  it('la administración llega por una función SECURITY DEFINER, no por un grant', () => {
    expect(SQL).toContain('public.es_administrador()');
    expect(SQL).toMatch(/CREATE OR REPLACE FUNCTION public\.es_administrador[\s\S]{0,200}SECURITY DEFINER/);
  });
});

describe('2. Esa regla, corrida de verdad, separa a una persona de la otra', () => {
  const ANA = '00000000-0000-4000-a900-00000000000a';
  const BRUNO = '00000000-0000-4000-a900-00000000000b';

  /**
   * El predicado de la política, evaluado en Postgres.
   *
   * Se reproducen `storage.foldername` tal como la define Supabase —las
   * carpetas del camino, sin el archivo— y se aplica la misma comparación. No
   * es la política de Supabase, es su lógica: lo que se prueba es que la
   * comparación haga lo que se cree.
   */
  async function puedeVer(quien: string, ruta: string): Promise<boolean> {
    const filas = await prisma.$queryRaw<{ puede: boolean }[]>`
      SELECT ((string_to_array(${ruta}, '/'))[1] = ${quien}) AS puede
    `;
    return filas[0]!.puede;
  }

  it('el dueño ve su propio comprobante', async () => {
    expect(await puedeVer(ANA, `${ANA}/pago-1/comprobante.pdf`)).toBe(true);
  });

  it('y NO ve el de otra persona', async () => {
    expect(await puedeVer(ANA, `${BRUNO}/pago-9/comprobante.pdf`)).toBe(false);
  });

  it('un nombre que intenta escaparse no lo convierte en dueño', async () => {
    // Aunque el nombre del archivo lleve `..`, la primera carpeta sigue siendo
    // la de Bruno: la comparación mira esa, no el resto del camino.
    expect(await puedeVer(ANA, `${BRUNO}/../${ANA}/comprobante.pdf`)).toBe(false);
  });

  it('un archivo suelto en la raíz no pertenece a nadie', async () => {
    expect(await puedeVer(ANA, 'comprobante.pdf')).toBe(false);
  });
});

describe('3. La carpeta que usa la API es la que pide la regla', () => {
  it('el id de la sesión ES el de Supabase, no uno propio', async () => {
    // Si `resolverDesdeToken` devolviera un identificador distinto del `sub`
    // del token, la API guardaría el comprobante en una carpeta que la política
    // no reconoce. Nada fallaría en el momento: los comprobantes simplemente
    // dejarían de poder abrirse.
    const sub = '00000000-0000-4000-a900-0000000000c1';
    const falso = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ id: sub, email: 'x@local', rol: 'CLIENTE', activo: true }),
      },
    } as unknown as PrismaService;

    const servicio = new UsuariosService(falso, {} as never, {} as never);
    const sesion = await servicio.resolverDesdeToken({ sub, email: 'x@local' } as SupabaseJwtPayload);

    expect(sesion.id).toBe(sub);
    expect(falso.usuario.findUnique).toHaveBeenCalledWith({ where: { id: sub } });
  });
});
