/**
 * Pruebas de los egresados y sus diplomas.
 *
 * Lo que se protege acá es, sobre todo, una cosa: que nadie aparezca publicado
 * sin haber firmado la autorización. Eso no es una regla de interfaz, es la
 * diferencia entre publicar una foto y cometer una infracción a la Ley 18.331.
 */
import { ConfigService } from '@nestjs/config';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CategoriaLicencia, RolUsuario } from '@prisma/client';

import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditoriaService } from '../src/common/auditoria/auditoria.service';
import { GraduadosService } from '../src/modules/graduados/graduados.service';
import { generarCodigo, normalizarCodigo } from '../src/modules/graduados/codigo';
import { ActualizarGraduadoDto } from '../src/modules/graduados/dto/graduado.dto';
import type { UsuarioAutenticado } from '../src/common/auth/jwt-payload.interface';

const prisma = new PrismaService();

// Un ConfigService mínimo: lo único que el servicio le pide es SUPABASE_URL,
// para armar la dirección pública de las fotos.
const config = {
  get: (clave: string) => (clave === 'SUPABASE_URL' ? 'https://proyecto.supabase.co' : undefined),
} as unknown as ConfigService;

const graduados = new GraduadosService(prisma, new AuditoriaService(prisma), config);

const ADMIN: UsuarioAutenticado = {
  id: '00000000-0000-4000-f000-000000000001',
  email: 'admin-grad@local',
  rol: RolUsuario.ADMIN,
};

const ID_CLIENTE = '00000000-0000-4000-f000-0000000000aa';
const ID_CLIENTE_2 = '00000000-0000-4000-f000-0000000000ab';

const creados: string[] = [];

/** Valida un DTO igual que lo haría el ValidationPipe global. */
async function validarDto<T extends object>(Clase: new () => T, cuerpo: unknown) {
  const instancia = plainToInstance(Clase, cuerpo, { enableImplicitConversion: false });
  return validate(instancia as object, { whitelist: true, forbidNonWhitelisted: true });
}

/** Da de alta un egresado y recuerda su id para limpiarlo después. */
async function alta(datos: Parameters<typeof graduados.crear>[0]) {
  const graduado = await graduados.crear(datos, ADMIN.id);
  creados.push(graduado.id);
  return graduado;
}

beforeAll(async () => {
  await prisma.$connect();
  await prisma.usuario.upsert({
    where: { id: ADMIN.id },
    update: {},
    create: {
      id: ADMIN.id,
      email: ADMIN.email,
      nombre: 'Admin',
      apellido: 'Graduados',
      rol: RolUsuario.ADMIN,
    },
  });
  for (const [id, nombre] of [
    [ID_CLIENTE, 'Alumno'],
    [ID_CLIENTE_2, 'Alumna'],
  ] as const) {
    await prisma.cliente.upsert({
      where: { id },
      update: {},
      create: { id, nombre, apellido: 'DePrueba' },
    });
  }
});

afterEach(async () => {
  if (creados.length === 0) return;
  await prisma.graduado.deleteMany({ where: { id: { in: creados } } });
  creados.length = 0;
});

afterAll(async () => {
  await prisma.graduado.deleteMany({ where: { clienteId: { in: [ID_CLIENTE, ID_CLIENTE_2] } } });
  await prisma.cliente.deleteMany({ where: { id: { in: [ID_CLIENTE, ID_CLIENTE_2] } } });
  await prisma.registroAuditoria.deleteMany({ where: { usuarioId: ADMIN.id } });
  await prisma.usuario.delete({ where: { id: ADMIN.id } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe('código de verificación', () => {
  it('no usa caracteres que se confunden al leerlos', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generarCodigo()).not.toMatch(/[0OIL1S5]/);
    }
  });

  it('reparte parejo: ningún carácter del alfabeto sale más que otro', () => {
    // Un carácter repetido en el alfabeto lo haría salir el doble de seguido y
    // achicaría el espacio real de códigos sin que se note.
    const cuenta = new Map<string, number>();
    for (let i = 0; i < 4000; i += 1) {
      for (const caracter of generarCodigo()) {
        cuenta.set(caracter, (cuenta.get(caracter) ?? 0) + 1);
      }
    }
    const frecuencias = [...cuenta.values()];
    const esperado = (4000 * 8) / cuenta.size;
    for (const frecuencia of frecuencias) {
      expect(frecuencia).toBeGreaterThan(esperado * 0.7);
      expect(frecuencia).toBeLessThan(esperado * 1.3);
    }
  });

  it('no es correlativo: 500 códigos seguidos son todos distintos', () => {
    const codigos = new Set(Array.from({ length: 500 }, () => generarCodigo()));
    expect(codigos.size).toBe(500);
  });

  it('normaliza lo que la persona tipea', () => {
    expect(normalizarCodigo('  abc2-def3 ')).toBe('ABC2DEF3');
  });
});

describe('la autorización manda', () => {
  it('no deja publicar sin autorización firmada', async () => {
    await expect(
      alta({
        clienteId: ID_CLIENTE,
        categoria: CategoriaLicencia.A,
        fechaEgreso: '2026-03-10',
        publicado: true,
      }),
    ).rejects.toThrow();
  });

  it('permite guardar sin autorización, mientras no se publique', async () => {
    const graduado = await alta({
      clienteId: ID_CLIENTE,
      categoria: CategoriaLicencia.A,
      fechaEgreso: '2026-03-10',
    });
    expect(graduado.publicado).toBe(false);
    expect(graduado.autorizacionAt).toBeNull();
  });

  it('no deja publicar después, si sigue sin autorización', async () => {
    const graduado = await alta({
      clienteId: ID_CLIENTE,
      categoria: CategoriaLicencia.A,
      fechaEgreso: '2026-03-10',
    });
    await expect(graduados.actualizar(graduado.id, { publicado: true } as never, ADMIN.id))
      .rejects.toThrow();
  });

  it('publica cuando la autorización está firmada', async () => {
    const graduado = await alta({
      clienteId: ID_CLIENTE,
      categoria: CategoriaLicencia.G1,
      fechaEgreso: '2026-04-15',
      autorizacionAt: '2026-04-15',
      autorizacionFirmante: 'El propio alumno',
      publicado: true,
    });
    expect(graduado.publicado).toBe(true);
  });

  it('exige el nombre de quien firma cuando firmó un tutor', async () => {
    await expect(
      alta({
        clienteId: ID_CLIENTE,
        categoria: CategoriaLicencia.G1,
        fechaEgreso: '2026-04-15',
        autorizacionAt: '2026-04-15',
        autorizacionEsTutor: true,
      }),
    ).rejects.toThrow();
  });

  it('retirar la autorización lo saca de la galería en la misma operación', async () => {
    const graduado = await alta({
      clienteId: ID_CLIENTE,
      categoria: CategoriaLicencia.A,
      fechaEgreso: '2026-05-20',
      autorizacionAt: '2026-05-20',
      autorizacionFirmante: 'El propio alumno',
      publicado: true,
    });

    const retirado = await graduados.retirarAutorizacion(graduado.id, ADMIN.id);
    expect(retirado.publicado).toBe(false);
    expect(retirado.autorizacionAt).toBeNull();
    expect(retirado.autorizacionFirmante).toBeNull();

    const { graduados: visibles } = await graduados.galeria({});
    expect(visibles.map((g) => g.id)).not.toContain(graduado.id);
  });
});

describe('el año se deriva de la fecha', () => {
  it('no se recibe de quien llama', async () => {
    const graduado = await alta({
      clienteId: ID_CLIENTE,
      categoria: CategoriaLicencia.A,
      fechaEgreso: '2024-11-30',
      // Un año contradictorio en el cuerpo no puede desincronizar nada.
      anio: 1999,
    } as never);
    expect(graduado.anio).toBe(2024);
  });

  it('se recalcula al cambiar la fecha', async () => {
    const graduado = await alta({
      clienteId: ID_CLIENTE,
      categoria: CategoriaLicencia.A,
      fechaEgreso: '2024-11-30',
    });
    const actualizado = await graduados.actualizar(
      graduado.id,
      { fechaEgreso: '2025-02-01' } as never,
      ADMIN.id,
    );
    expect(actualizado.anio).toBe(2025);
  });
});

describe('lo que ve el público', () => {
  beforeEach(async () => {
    for (const [fecha, cliente] of [
      ['2026-03-01', ID_CLIENTE],
      ['2026-06-01', ID_CLIENTE_2],
      ['2025-03-01', ID_CLIENTE],
    ] as const) {
      await alta({
        clienteId: cliente,
        categoria: CategoriaLicencia.A,
        fechaEgreso: fecha,
        autorizacionAt: fecha,
        autorizacionFirmante: 'El propio alumno',
        publicado: true,
      });
    }
    // Uno sin publicar, que no debe aparecer nunca.
    await alta({
      clienteId: ID_CLIENTE,
      categoria: CategoriaLicencia.A,
      fechaEgreso: '2026-07-01',
    });
  });

  it('no filtra datos sensibles del alumno', async () => {
    const { graduados: filas } = await graduados.galeria({});
    expect(filas.length).toBeGreaterThan(0);
    for (const fila of filas) {
      expect(Object.keys(fila).sort()).toEqual(
        ['anio', 'apellido', 'categoria', 'fotoUrl', 'id', 'nombre'].sort(),
      );
    }
  });

  it('no incluye a los no publicados', async () => {
    const { graduados: filas, total } = await graduados.galeria({ porPagina: 100 });
    const sinPublicar = await prisma.graduado.findFirst({
      where: { id: { in: creados }, publicado: false },
    });
    expect(sinPublicar).not.toBeNull();
    expect(filas.map((g) => g.id)).not.toContain(sinPublicar!.id);
    expect(total).toBe(filas.length);
  });

  it('pagina de a 10 por defecto', async () => {
    const pagina = await graduados.galeria({});
    expect(pagina.porPagina).toBe(10);
    expect(pagina.pagina).toBe(1);
  });

  it('acepta los tamaños permitidos', async () => {
    for (const tamano of [10, 20, 50, 100]) {
      expect((await graduados.galeria({ porPagina: tamano })).porPagina).toBe(tamano);
    }
  });

  it('ignora un tamaño de página desmedido en vez de obedecerlo', async () => {
    // El DTO ya lo rechaza en el borde HTTP; esta es la segunda barrera, para
    // que ninguna llamada interna pueda pedir la tabla entera.
    expect((await graduados.galeria({ porPagina: 100000 })).porPagina).toBe(10);
    expect((await graduados.galeria({ porPagina: 0 })).porPagina).toBe(10);
  });

  it('filtra por año', async () => {
    const pagina = await graduados.galeria({ anio: 2025 });
    expect(pagina.graduados.length).toBeGreaterThan(0);
    expect(pagina.graduados.every((g) => g.anio === 2025)).toBe(true);
  });

  it('devuelve los años que tienen egresados publicados, del más nuevo al más viejo', async () => {
    const anios = await graduados.aniosPublicados();
    expect(anios).toEqual([...anios].sort((a, b) => b - a));
    expect(anios).toContain(2026);
    expect(anios).toContain(2025);
  });

  it('las páginas no se pisan ni repiten', async () => {
    const primera = await graduados.galeria({ porPagina: 10, pagina: 1 });
    const segunda = await graduados.galeria({ porPagina: 10, pagina: 2 });
    const ids = [...primera.graduados, ...segunda.graduados].map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('verificación del diploma', () => {
  it('devuelve lo mínimo para confirmar que es auténtico', async () => {
    const graduado = await alta({
      clienteId: ID_CLIENTE,
      categoria: CategoriaLicencia.G2,
      fechaEgreso: '2026-08-01',
    });
    const resultado = await graduados.verificar(graduado.codigo);
    expect(resultado.valido).toBe(true);
    expect(resultado.categoria).toBe(CategoriaLicencia.G2);
    expect(Object.keys(resultado).sort()).toEqual(
      ['anio', 'apellido', 'categoria', 'fechaEgreso', 'nombre', 'valido'].sort(),
    );
  });

  it('funciona aunque el egresado no esté publicado: son cosas distintas', async () => {
    const graduado = await alta({
      clienteId: ID_CLIENTE,
      categoria: CategoriaLicencia.A,
      fechaEgreso: '2026-08-01',
    });
    expect(graduado.publicado).toBe(false);
    await expect(graduados.verificar(graduado.codigo)).resolves.toHaveProperty('valido', true);
  });

  it('tolera mayúsculas, minúsculas y espacios', async () => {
    const graduado = await alta({
      clienteId: ID_CLIENTE,
      categoria: CategoriaLicencia.A,
      fechaEgreso: '2026-08-01',
    });
    await expect(graduados.verificar(` ${graduado.codigo.toLowerCase()} `)).resolves.toHaveProperty(
      'valido',
      true,
    );
  });

  it('un código inventado no existe', async () => {
    await expect(graduados.verificar('ZZZZZZZZ')).rejects.toThrow(/no existe/i);
  });
});

describe('la foto', () => {
  it('solo acepta una ruta dentro del bucket, nunca una dirección externa', async () => {
    const rechazadas = [
      'https://sitio-ajeno.com/foto.jpg',
      '//evil.com/foto.jpg',
      'javascript:alert(1)',
      '../../../etc/passwd',
      'otro-bucket/archivo.jpg',
      '11111111-1111-4111-8111-111111111111/../fuera.jpg',
      '11111111-1111-4111-8111-111111111111/script.svg',
      '11111111-1111-4111-8111-111111111111/foto.html',
      'no-es-uuid/foto.jpg',
    ];
    for (const ruta of rechazadas) {
      const errores = await validarDto(ActualizarGraduadoDto, { fotoRuta: ruta });
      expect(errores.length).toBeGreaterThan(0);
    }
  });

  it('acepta la ruta con la forma esperada', async () => {
    const errores = await validarDto(ActualizarGraduadoDto, {
      fotoRuta: '11111111-1111-4111-8111-111111111111/foto-2026.jpg',
    });
    expect(errores).toHaveLength(0);
  });

  it('permite sacar la foto con cadena vacía', async () => {
    expect(await validarDto(ActualizarGraduadoDto, { fotoRuta: '' })).toHaveLength(0);
  });

  it('el sitio recibe la dirección armada, no la ruta cruda', async () => {
    const graduado = await alta({
      clienteId: ID_CLIENTE,
      categoria: CategoriaLicencia.A,
      fechaEgreso: '2026-02-10',
      autorizacionAt: '2026-02-10',
      autorizacionFirmante: 'El propio alumno',
      publicado: true,
    });
    await prisma.graduado.update({
      where: { id: graduado.id },
      data: { fotoRuta: `${graduado.id}/foto.jpg` },
    });

    const { graduados: filas } = await graduados.galeria({ porPagina: 100 });
    const fila = filas.find((g) => g.id === graduado.id);
    expect(fila?.fotoUrl).toBe(
      `https://proyecto.supabase.co/storage/v1/object/public/graduados/${graduado.id}/foto.jpg`,
    );
  });

  it('sin foto, la dirección viene en null y no en un texto roto', async () => {
    const graduado = await alta({
      clienteId: ID_CLIENTE,
      categoria: CategoriaLicencia.A,
      fechaEgreso: '2026-02-11',
      autorizacionAt: '2026-02-11',
      autorizacionFirmante: 'El propio alumno',
      publicado: true,
    });
    const { graduados: filas } = await graduados.galeria({ porPagina: 100 });
    expect(filas.find((g) => g.id === graduado.id)?.fotoUrl).toBeNull();
  });
});

describe('borrado', () => {
  it('el derecho de supresión borra de verdad y queda auditado', async () => {
    const graduado = await alta({
      clienteId: ID_CLIENTE,
      categoria: CategoriaLicencia.A,
      fechaEgreso: '2026-09-01',
    });
    await graduados.eliminar(graduado.id, ADMIN.id);

    expect(await prisma.graduado.findUnique({ where: { id: graduado.id } })).toBeNull();
    const registro = await prisma.registroAuditoria.findFirst({
      where: { accion: 'GRADUADO_ELIMINADO', entidadId: graduado.id },
    });
    expect(registro).not.toBeNull();
  });
});
