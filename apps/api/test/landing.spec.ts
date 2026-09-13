/**
 * Pruebas del contenido editable del sitio público.
 *
 * Lo que se protege acá:
 * - Que la API no acepte secciones inventadas ni enlaces peligrosos.
 * - Que vaciar un campo devuelva la sección al texto por defecto del sitio, en
 *   vez de dejarla con un encabezado en blanco.
 * - Que el sitio público nunca reciba campos internos del negocio.
 */
import { RolUsuario } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditoriaService } from '../src/common/auditoria/auditoria.service';
import { LandingService } from '../src/modules/landing/landing.service';
import { LandingController } from '../src/modules/landing/landing.controller';
import { ActualizarNegocioDto } from '../src/modules/landing/dto/negocio.dto';
import { ActualizarSeccionDto } from '../src/modules/landing/dto/seccion.dto';
import {
  SECCIONES_LANDING,
  esClaveValida,
  ordenPorDefecto,
} from '../src/modules/landing/claves';
import type { UsuarioAutenticado } from '../src/common/auth/jwt-payload.interface';

const prisma = new PrismaService();
const servicio = new LandingService(prisma, new AuditoriaService(prisma));
const controlador = new LandingController(servicio);

const ADMIN: UsuarioAutenticado = {
  id: '00000000-0000-4000-e000-000000000001',
  email: 'admin-landing@local',
  rol: RolUsuario.ADMIN,
};

/** Secciones que tocan las pruebas, para poder dejar la base como estaba. */
const CLAVES_DE_PRUEBA = ['preguntas', 'hero', 'galeria'] as const;

/** Valida un DTO igual que lo haría el ValidationPipe global. */
async function validarDto<T extends object>(Clase: new () => T, cuerpo: unknown) {
  const instancia = plainToInstance(Clase, cuerpo, { enableImplicitConversion: false });
  const errores = await validate(instancia as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errores;
}

let negocioOriginal: Awaited<ReturnType<typeof servicio.obtenerNegocio>>;

beforeAll(async () => {
  await prisma.$connect();

  // El registro de auditoría tiene clave foránea a `usuarios`. Sin este usuario
  // el insert falla, el servicio se traga el error a propósito —auditar nunca
  // debe tumbar la operación— y la prueba de auditoría no vería nada.
  await prisma.usuario.upsert({
    where: { id: ADMIN.id },
    update: {},
    create: { id: ADMIN.id, email: ADMIN.email, nombre: 'Admin', apellido: 'Landing', rol: RolUsuario.ADMIN },
  });

  negocioOriginal = await servicio.obtenerNegocio();
  await prisma.seccionLanding.deleteMany({ where: { clave: { in: [...CLAVES_DE_PRUEBA] } } });
});

afterAll(async () => {
  await prisma.seccionLanding.deleteMany({ where: { clave: { in: [...CLAVES_DE_PRUEBA] } } });
  await prisma.configuracionAcademia.update({ where: { id: 1 }, data: negocioOriginal });
  await prisma.registroAuditoria.deleteMany({ where: { usuarioId: ADMIN.id } });
  await prisma.usuario.delete({ where: { id: ADMIN.id } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe('claves de sección', () => {
  it('acepta solo las secciones declaradas', () => {
    expect(esClaveValida('preguntas')).toBe(true);
    expect(esClaveValida('pregntas')).toBe(false);
    expect(esClaveValida('__proto__')).toBe(false);
    expect(esClaveValida('')).toBe(false);
  });

  it('el controlador rechaza una clave desconocida', () => {
    // Lanza de forma síncrona, antes de devolver la promesa: la aserción tiene
    // que envolver la llamada, no su resultado.
    expect(() => controlador.actualizarSeccion('seccion-inventada', { titulo: 'Hola' }, ADMIN))
      .toThrow(/no existe/i);
  });

  it('no quedan claves duplicadas en la lista', () => {
    const claves = SECCIONES_LANDING.map((seccion) => seccion.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });
});

describe('validación de los datos del negocio', () => {
  it('rechaza un enlace javascript: en el mapa', async () => {
    const errores = await validarDto(ActualizarNegocioDto, {
      mapaUrl: 'javascript:alert(document.cookie)',
    });
    expect(errores).toHaveLength(1);
    expect(errores[0].property).toBe('mapaUrl');
  });

  it('rechaza enlaces con otros esquemas peligrosos', async () => {
    for (const url of ['data:text/html,<script>x</script>', 'vbscript:msgbox(1)', 'file:///etc/passwd']) {
      const errores = await validarDto(ActualizarNegocioDto, { instagram: url });
      expect(errores.length).toBeGreaterThan(0);
    }
  });

  it('acepta un enlace https normal', async () => {
    const errores = await validarDto(ActualizarNegocioDto, {
      mapaUrl: 'https://maps.app.goo.gl/ejemplo',
    });
    expect(errores).toHaveLength(0);
  });

  it('el WhatsApp solo acepta dígitos con código de país', async () => {
    expect(await validarDto(ActualizarNegocioDto, { whatsapp: '59899123456' })).toHaveLength(0);
    expect((await validarDto(ActualizarNegocioDto, { whatsapp: '+598 99 123 456' })).length)
      .toBeGreaterThan(0);
    expect((await validarDto(ActualizarNegocioDto, { whatsapp: '123' })).length).toBeGreaterThan(0);
  });

  it('permite vaciar un campo con cadena vacía', async () => {
    expect(await validarDto(ActualizarNegocioDto, { whatsapp: '', mapaUrl: '' })).toHaveLength(0);
  });

  it('rechaza campos que no están declarados', async () => {
    const errores = await validarDto(ActualizarNegocioDto, { rol: 'ADMIN' });
    expect(errores.length).toBeGreaterThan(0);
  });
});

describe('validación del contenido de una sección', () => {
  it('rechaza un título desmedido', async () => {
    const errores = await validarDto(ActualizarSeccionDto, { titulo: 'x'.repeat(201) });
    expect(errores).toHaveLength(1);
  });

  it('limita la cantidad de ítems', async () => {
    const items = Array.from({ length: 21 }, (_, i) => ({ titulo: `Pregunta ${i}` }));
    const errores = await validarDto(ActualizarSeccionDto, { items });
    expect(errores).toHaveLength(1);
  });

  it('valida el contenido de cada ítem, no solo la lista', async () => {
    const errores = await validarDto(ActualizarSeccionDto, {
      items: [{ titulo: 'Bien' }, { titulo: '' }],
    });
    expect(errores.length).toBeGreaterThan(0);
  });

  it('rechaza un orden fuera de rango', async () => {
    expect((await validarDto(ActualizarSeccionDto, { orden: -1 })).length).toBeGreaterThan(0);
    expect((await validarDto(ActualizarSeccionDto, { orden: 100 })).length).toBeGreaterThan(0);
  });
});

describe('guardado de secciones', () => {
  it('crea la sección con su posición por defecto si no se indica orden', async () => {
    await servicio.actualizarSeccion('galeria', { titulo: 'Nuestra galería' }, ADMIN.id);
    const guardada = await prisma.seccionLanding.findUnique({ where: { clave: 'galeria' } });
    expect(guardada?.orden).toBe(ordenPorDefecto('galeria'));
    expect(guardada?.orden).toBeGreaterThan(0);
  });

  it('una cadena vacía borra el texto y devuelve la sección al valor por defecto', async () => {
    await servicio.actualizarSeccion('hero', { titulo: 'Título propio' }, ADMIN.id);
    expect((await prisma.seccionLanding.findUnique({ where: { clave: 'hero' } }))?.titulo)
      .toBe('Título propio');

    await servicio.actualizarSeccion('hero', { titulo: '   ' }, ADMIN.id);
    expect((await prisma.seccionLanding.findUnique({ where: { clave: 'hero' } }))?.titulo)
      .toBeNull();
  });

  it('no pisa los campos que no se enviaron', async () => {
    await servicio.actualizarSeccion('preguntas', { titulo: 'Dudas', bajada: 'Consultanos' }, ADMIN.id);
    await servicio.actualizarSeccion('preguntas', { visible: false }, ADMIN.id);

    const guardada = await prisma.seccionLanding.findUnique({ where: { clave: 'preguntas' } });
    expect(guardada?.titulo).toBe('Dudas');
    expect(guardada?.bajada).toBe('Consultanos');
    expect(guardada?.visible).toBe(false);
  });

  it('guarda la lista de ítems', async () => {
    await servicio.actualizarSeccion(
      'preguntas',
      { items: [{ titulo: '¿Cuánto cuesta?', detalle: 'Depende del plan.' }] },
      ADMIN.id,
    );
    const guardada = await prisma.seccionLanding.findUnique({ where: { clave: 'preguntas' } });
    expect(guardada?.items).toEqual([{ titulo: '¿Cuánto cuesta?', detalle: 'Depende del plan.' }]);
  });

  it('deja rastro en la auditoría', async () => {
    await servicio.actualizarSeccion('galeria', { visible: false }, ADMIN.id);
    const registro = await prisma.registroAuditoria.findFirst({
      where: { accion: 'LANDING_SECCION_ACTUALIZADA', entidadId: 'galeria' },
      orderBy: { createdAt: 'desc' },
    });
    expect(registro).not.toBeNull();
    expect(registro?.usuarioId).toBe(ADMIN.id);
  });
});

describe('el panel ve todas las secciones', () => {
  it('devuelve la lista completa aunque la base esté vacía', async () => {
    const secciones = await servicio.listarParaPanel();
    expect(secciones).toHaveLength(SECCIONES_LANDING.length);
    expect(secciones.map((seccion) => seccion.clave)).toEqual(
      expect.arrayContaining(SECCIONES_LANDING.map((seccion) => seccion.clave)),
    );
  });

  it('viene ordenada', async () => {
    const secciones = await servicio.listarParaPanel();
    const ordenes = secciones.map((s) => s.orden);
    expect([...ordenes].sort((a, b) => a - b)).toEqual(ordenes);
  });
});

describe('lo que llega al sitio público', () => {
  it('no expone campos internos del negocio', async () => {
    const { negocio } = await servicio.contenidoPublico();
    expect(negocio).not.toBeNull();

    // Las políticas de reserva son configuración interna de la agenda: no tienen
    // por qué viajar al sitio público.
    for (const campo of [
      'bufferMinutos',
      'antelacionMinimaHoras',
      'cancelacionMinimaHoras',
      'ventanaReservaDias',
      'updatedAt',
      'id',
    ]) {
      expect(negocio).not.toHaveProperty(campo);
    }
  });

  it('incluye las secciones ocultas con su bandera, para que el sitio decida', async () => {
    await servicio.actualizarSeccion('galeria', { visible: false }, ADMIN.id);
    const { secciones } = await servicio.contenidoPublico();
    const galeria = secciones.find((s) => s.clave === 'galeria');
    expect(galeria?.visible).toBe(false);
  });

  it('no filtra quién editó cada sección', async () => {
    const { secciones } = await servicio.contenidoPublico();
    for (const seccion of secciones) {
      expect(seccion).not.toHaveProperty('actualizadoPor');
    }
  });
});
