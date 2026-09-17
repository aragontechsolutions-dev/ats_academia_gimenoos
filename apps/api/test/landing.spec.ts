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
import { telegramCallado } from './ayuda/telegram-callado';

const prisma = new PrismaService();
const servicio = new LandingService(prisma, new AuditoriaService(prisma));
const controlador = new LandingController(servicio, telegramCallado());

const ADMIN: UsuarioAutenticado = {
  id: '00000000-0000-4000-e000-000000000001',
  email: 'admin-landing@local',
  rol: RolUsuario.ADMIN,
};

/** Secciones que tocan las pruebas, para poder dejar la base como estaba. */
const CLAVES_DE_PRUEBA = ['preguntas', 'hero', 'testimonios'] as const;

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

  // La fila de configuración tiene que existir: es única —id fijo en 1— y el
  // servicio la exige.
  //
  // Este archivo la daba por hecha, y funcionaba de casualidad: otras pruebas la
  // crean en su propio `beforeAll`, así que alcanzaba con que alguna corriera
  // antes. Sobre una base recién migrada y sin datos —que es como arranca la
  // CI—, el archivo entero fallaba o pasaba según el orden en que jest tomara
  // los archivos, y ese orden depende del tamaño de cada uno. Agrandar este
  // archivo fue suficiente para darlo vuelta.
  await prisma.configuracionAcademia.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

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

  it('el WhatsApp se acepta escrito de cualquiera de las formas usuales', async () => {
    // La regla vieja exigia digitos con codigo de pais y rechazaba todo lo
    // demas. Era peor de lo que parecia: dejaba pasar `092331784` —un celular
    // uruguayo bien escrito, nueve digitos— y con eso wa.me abria un chat con
    // un numero de otro pais. Ahora se acepta como lo escriba la persona y el
    // servicio lo normaliza, que es lo mismo que se hace con los alumnos.
    for (const forma of ['59899123456', '+598 99 123 456', '099123456', '099 123 456']) {
      expect(await validarDto(ActualizarNegocioDto, { whatsapp: forma })).toHaveLength(0);
    }
  });

  it('un WhatsApp que no es un número lo frena el servicio', async () => {
    // El DTO solo acota el largo; la regla de verdad está en `normalizarTelefono`
    // y es la misma para todos los teléfonos del sistema.
    expect(await validarDto(ActualizarNegocioDto, { whatsapp: '123' })).toHaveLength(0);
    await expect(servicio.actualizarNegocio({ whatsapp: '123' }, ADMIN.id)).rejects.toThrow(
      /8 dígitos/,
    );
  });

  it('un WhatsApp desmedido no llega ni al servicio', async () => {
    expect((await validarDto(ActualizarNegocioDto, { whatsapp: '9'.repeat(26) })).length)
      .toBeGreaterThan(0);
  });

  it('permite vaciar un campo con cadena vacía', async () => {
    expect(await validarDto(ActualizarNegocioDto, { whatsapp: '', mapaUrl: '' })).toHaveLength(0);
  });

  it('rechaza campos que no están declarados', async () => {
    const errores = await validarDto(ActualizarNegocioDto, { rol: 'ADMIN' });
    expect(errores.length).toBeGreaterThan(0);
  });
});

describe('el teléfono y el correo del negocio', () => {
  // Los datos de la academia se validaban distinto que los de un alumno: el
  // teléfono no se normalizaba y el correo usaba una expresión regular propia.
  // El mismo número quedaba escrito de dos formas segun donde se cargara.

  it('el teléfono se guarda igual que el de un alumno', async () => {
    for (const forma of ['098663201', '098 663 201', '+598 98663201', '598 98663201']) {
      const guardado = await servicio.actualizarNegocio({ telefono: forma }, ADMIN.id);
      expect(guardado.telefono).toBe('+598 98663201');
    }
  });

  it('el WhatsApp también, y eso es lo que arregla el enlace', async () => {
    // Guardado como lo escribe cualquiera acá, el enlace de wa.me salia roto.
    const guardado = await servicio.actualizarNegocio({ whatsapp: '092331784' }, ADMIN.id);
    expect(guardado.whatsapp).toBe('+598 92331784');
  });

  it('un teléfono que no es un teléfono se rechaza con un mensaje que explica', async () => {
    await expect(servicio.actualizarNegocio({ telefono: '123' }, ADMIN.id)).rejects.toThrow(
      /8 dígitos/,
    );
  });

  it('el correo se guarda en minúscula, como el de un alumno', async () => {
    const guardado = await servicio.actualizarNegocio({ email: '  Hola@Gimenoos.UY ' }, ADMIN.id);
    expect(guardado.email).toBe('hola@gimenoos.uy');
  });

  it('el correo se valida con IsEmail, no con una expresión propia', async () => {
    for (const malo of ['sin-arroba', 'dos@@arrobas.com', 'espacio @ejemplo.com', '@ejemplo.com']) {
      const errores = await validarDto(ActualizarNegocioDto, { email: malo });
      expect(errores.length).toBeGreaterThan(0);
    }
  });

  it('la cadena vacía sigue borrando el dato', async () => {
    await servicio.actualizarNegocio({ telefono: '098663201', whatsapp: '092331784' }, ADMIN.id);
    const vacio = await servicio.actualizarNegocio(
      { telefono: '', whatsapp: '', email: '' },
      ADMIN.id,
    );
    expect(vacio.telefono).toBeNull();
    expect(vacio.whatsapp).toBeNull();
    expect(vacio.email).toBeNull();
  });

  it('no tocar un campo lo deja como estaba', async () => {
    await servicio.actualizarNegocio({ telefono: '098663201' }, ADMIN.id);
    const despues = await servicio.actualizarNegocio({ horarios: 'Lunes a viernes' }, ADMIN.id);
    expect(despues.telefono).toBe('+598 98663201');
  });
});

describe('el punto de la academia en el mapa', () => {
  const PUNTO = { latitud: -34.795123, longitud: -54.918456 };

  afterEach(async () => {
    await prisma.configuracionAcademia.update({
      where: { id: 1 },
      data: { latitud: null, longitud: null },
    });
  });

  it('acepta un punto dentro del planeta', async () => {
    expect(await validarDto(ActualizarNegocioDto, PUNTO)).toHaveLength(0);
  });

  it('rechaza coordenadas fuera de rango', async () => {
    // Una latitud de 91 no existe. Suele ser latitud y longitud invertidas.
    expect((await validarDto(ActualizarNegocioDto, { latitud: 91, longitud: 0 })).length)
      .toBeGreaterThan(0);
    expect((await validarDto(ActualizarNegocioDto, { latitud: 0, longitud: 181 })).length)
      .toBeGreaterThan(0);
  });

  it('rechaza una coordenada escrita como texto', async () => {
    // El panel manda números. Un texto acá significa que algo se armó mal, y
    // Prisma lo rechazaría después con un error mucho menos claro.
    expect((await validarDto(ActualizarNegocioDto, { latitud: '-34.79', longitud: '-54.91' })).length)
      .toBeGreaterThan(0);
  });

  it('se guarda y vuelve en el contenido público', async () => {
    await servicio.actualizarNegocio(PUNTO, ADMIN.id);

    const publico = await servicio.contenidoPublico();
    expect(publico.negocio?.latitud).toBeCloseTo(PUNTO.latitud, 6);
    expect(publico.negocio?.longitud).toBeCloseTo(PUNTO.longitud, 6);
  });

  it('media coordenada se rechaza con un mensaje entendible', async () => {
    // La base tiene un CHECK que también lo impide, pero su error llega en
    // inglés y con el nombre de la restricción adentro.
    await expect(servicio.actualizarNegocio({ latitud: -34.79 }, ADMIN.id)).rejects.toThrow(
      /latitud y longitud/i,
    );
    await expect(servicio.actualizarNegocio({ longitud: -54.91 }, ADMIN.id)).rejects.toThrow(
      /latitud y longitud/i,
    );
  });

  it('guardar otro dato no obliga a tener el punto marcado', async () => {
    // Sin esto, tocar el teléfono de una academia sin ubicación fallaría.
    await expect(servicio.actualizarNegocio({ horarios: 'Lunes a viernes' }, ADMIN.id))
      .resolves.toBeDefined();
  });

  it('se puede borrar el punto mandando las dos en null', async () => {
    await servicio.actualizarNegocio(PUNTO, ADMIN.id);
    const sinPunto = await servicio.actualizarNegocio(
      { latitud: null, longitud: null },
      ADMIN.id,
    );

    expect(sinPunto.latitud).toBeNull();
    expect(sinPunto.longitud).toBeNull();
  });

  it('la base impide media coordenada aunque se la salteara la API', async () => {
    await expect(
      prisma.configuracionAcademia.update({
        where: { id: 1 },
        data: { latitud: -34.79, longitud: null },
      }),
    ).rejects.toThrow();
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
    await servicio.actualizarSeccion('testimonios', { titulo: 'Lo que dicen' }, ADMIN.id);
    const guardada = await prisma.seccionLanding.findUnique({ where: { clave: 'testimonios' } });
    expect(guardada?.orden).toBe(ordenPorDefecto('testimonios'));
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
    await servicio.actualizarSeccion('testimonios', { visible: false }, ADMIN.id);
    const registro = await prisma.registroAuditoria.findFirst({
      where: { accion: 'LANDING_SECCION_ACTUALIZADA', entidadId: 'testimonios' },
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
    await servicio.actualizarSeccion('testimonios', { visible: false }, ADMIN.id);
    const { secciones } = await servicio.contenidoPublico();
    const testimonios = secciones.find((s) => s.clave === 'testimonios');
    expect(testimonios?.visible).toBe(false);
  });

  it('no filtra quién editó cada sección', async () => {
    const { secciones } = await servicio.contenidoPublico();
    for (const seccion of secciones) {
      expect(seccion).not.toHaveProperty('actualizadoPor');
    }
  });
});
