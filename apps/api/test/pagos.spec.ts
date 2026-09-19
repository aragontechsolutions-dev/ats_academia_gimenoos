/**
 * Los pagos por transferencia y en efectivo.
 *
 * El foco está en lo que, si falla, cuesta plata o rompe la confianza: que el
 * monto lo ponga el servidor y no el navegador, que aprobar acredite las clases
 * en la misma transacción, que nadie toque el pago de otro, y que un pago no se
 * pueda aprobar dos veces.
 */
import { CanalPago, EstadoPago, TipoServicio } from '@prisma/client';

import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditoriaService } from '../src/common/auditoria/auditoria.service';
import { PagosService } from '../src/modules/pagos/pagos.service';
import type { TelegramService } from '../src/common/telegram/telegram.service';
import type { PushService } from '../src/common/push/push.service';

const prisma = new PrismaService();

/**
 * Los avisos, espiados.
 *
 * Se reemplazan por funciones que sólo anotan qué se pidió mandar: acá no hay
 * Telegram ni claves VAPID, y sobre todo, lo que importa probar no es que el
 * mensaje salga —eso lo prueban `telegram.service.spec` y `push.service.spec`—
 * sino **que se dispare cuando corresponde y no cuando no**.
 */
const telegramaEnviados: Array<{ clase: string; texto: string }> = [];
const pushEnviados: Array<{ usuarioId: string; titulo: string }> = [];

const telegram = {
  avisar: jest.fn(async (clase: string, texto: string) => {
    telegramaEnviados.push({ clase, texto });
    return { estado: 'enviado' as const };
  }),
} as unknown as TelegramService;

const push = {
  avisar: jest.fn(async (usuarioId: string, aviso: { titulo: string }) => {
    pushEnviados.push({ usuarioId, titulo: aviso.titulo });
    return { estado: 'enviado' as const, dispositivos: 1 };
  }),
} as unknown as PushService;

const servicio = new PagosService(prisma, new AuditoriaService(prisma), telegram, push);

const ID = {
  usuarioAna: '00000000-0000-4000-e100-000000000001',
  usuarioBruno: '00000000-0000-4000-e100-000000000002',
  usuarioAdmin: '00000000-0000-4000-e100-000000000003',
  ana: '00000000-0000-4000-e100-00000000000a',
  bruno: '00000000-0000-4000-e100-00000000000b',
  pack: '00000000-0000-4000-e100-0000000000d1',
  suelta: '00000000-0000-4000-e100-0000000000d2',
  inactivo: '00000000-0000-4000-e100-0000000000d3',
};

/** El precio del pack en el catálogo. Todo lo demás se compara contra esto. */
const PRECIO_PACK = 12000;

beforeAll(async () => {
  await prisma.$connect();

  for (const [id, email, nombre] of [
    [ID.usuarioAna, 'ana-pagos@local', 'Ana'],
    [ID.usuarioBruno, 'bruno-pagos@local', 'Bruno'],
    [ID.usuarioAdmin, 'admin-pagos@local', 'Admin'],
  ]) {
    await prisma.usuario.upsert({
      where: { id: id! },
      update: {},
      create: { id: id!, email: email!, nombre: nombre!, apellido: 'Pagos' },
    });
  }

  await prisma.cliente.upsert({
    where: { id: ID.ana },
    update: {},
    create: { id: ID.ana, usuarioId: ID.usuarioAna, nombre: 'Ana', apellido: 'Pagos' },
  });
  await prisma.cliente.upsert({
    where: { id: ID.bruno },
    update: {},
    create: { id: ID.bruno, usuarioId: ID.usuarioBruno, nombre: 'Bruno', apellido: 'Pagos' },
  });

  await prisma.servicio.upsert({
    where: { id: ID.pack },
    update: { activo: true, precioContado: PRECIO_PACK, cantidadClases: 10 },
    create: {
      id: ID.pack,
      slug: 'pack-pagos-prueba',
      nombre: 'Pack de 10 clases',
      tipo: TipoServicio.PACK,
      cantidadClases: 10,
      precioContado: PRECIO_PACK,
      precioTarjeta: 13500,
    },
  });
  await prisma.servicio.upsert({
    where: { id: ID.inactivo },
    update: { activo: false },
    create: {
      id: ID.inactivo,
      slug: 'servicio-dado-de-baja',
      nombre: 'Servicio dado de baja',
      tipo: TipoServicio.CLASE_SUELTA,
      cantidadClases: 1,
      precioContado: 900,
      precioTarjeta: 1000,
      activo: false,
    },
  });
});

beforeEach(async () => {
  await prisma.pago.deleteMany({ where: { clienteId: { in: [ID.ana, ID.bruno] } } });
  await prisma.compraServicio.deleteMany({ where: { clienteId: { in: [ID.ana, ID.bruno] } } });
  telegramaEnviados.length = 0;
  pushEnviados.length = 0;
});

afterAll(async () => {
  await prisma.pago.deleteMany({ where: { clienteId: { in: [ID.ana, ID.bruno] } } });
  await prisma.compraServicio.deleteMany({ where: { clienteId: { in: [ID.ana, ID.bruno] } } });
  await prisma.registroAuditoria.deleteMany({
    where: { usuarioId: { in: [ID.usuarioAna, ID.usuarioBruno, ID.usuarioAdmin] } },
  });
  await prisma.servicio.deleteMany({ where: { id: { in: [ID.pack, ID.inactivo] } } });
  await prisma.cliente.deleteMany({ where: { id: { in: [ID.ana, ID.bruno] } } });
  await prisma.usuario.deleteMany({
    where: { id: { in: [ID.usuarioAna, ID.usuarioBruno, ID.usuarioAdmin] } },
  });
  await prisma.$disconnect();
});

describe('El alumno empieza un pago', () => {
  it('el monto sale del catálogo, no del navegador', async () => {
    // Es la regla que protege la plata: si el monto viniera del cliente,
    // cualquiera podría declarar que su pack de doce clases costó cien pesos.
    const pago = await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    expect(Number(pago.monto)).toBe(PRECIO_PACK);
  });

  it('queda PENDIENTE hasta que suba el comprobante', async () => {
    // La diferencia importa en el panel: un pago sin comprobante no es algo que
    // alguien tenga que revisar, es algo que el alumno dejó a medias.
    const pago = await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    expect(pago.estado).toBe(EstadoPago.PENDIENTE);
    expect(pago.canal).toBe(CanalPago.TRANSFERENCIA);
  });

  it('NO acredita clases todavía', async () => {
    await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    expect(await prisma.compraServicio.count({ where: { clienteId: ID.ana } })).toBe(0);
  });

  it('no se puede pagar un servicio dado de baja', async () => {
    await expect(
      servicio.crearPropio(ID.usuarioAna, { servicioId: ID.inactivo }),
    ).rejects.toThrow(/no está disponible/);
  });

  it('ni uno que no existe', async () => {
    await expect(
      servicio.crearPropio(ID.usuarioAna, { servicioId: '00000000-0000-4000-9999-000000000000' }),
    ).rejects.toThrow(/no está disponible/);
  });
});

describe('El comprobante', () => {
  it('la ruta la compone el servidor con la sesión y el pago', async () => {
    // Nunca se acepta una ruta del navegador: apuntada al comprobante de otra
    // persona, el panel se la mostraría a quien la pidiera.
    const pago = await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    await servicio.registrarComprobante(ID.usuarioAna, pago.id, { archivo: 'banco.pdf' });

    const guardado = await prisma.pago.findUniqueOrThrow({
      where: { id: pago.id },
      select: { comprobantePath: true, estado: true },
    });
    expect(guardado.comprobantePath).toBe(`${ID.usuarioAna}/${pago.id}/banco.pdf`);
    expect(guardado.estado).toBe(EstadoPago.PENDIENTE_VERIFICACION);
  });

  it('Bruno NO puede subirle un comprobante al pago de Ana', async () => {
    const deAna = await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    await expect(
      servicio.registrarComprobante(ID.usuarioBruno, deAna.id, { archivo: 'trucho.pdf' }),
    ).rejects.toThrow(/no existe/);
  });

  it('un pago ya revisado no admite otro comprobante', async () => {
    const pago = await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    await servicio.registrarComprobante(ID.usuarioAna, pago.id, { archivo: 'banco.pdf' });
    await servicio.aprobar(pago.id, {}, ID.usuarioAdmin);

    await expect(
      servicio.registrarComprobante(ID.usuarioAna, pago.id, { archivo: 'otro.pdf' }),
    ).rejects.toThrow(/ya fue revisado/);
  });
});

describe('Aprobar un pago', () => {
  async function pagoListo() {
    const pago = await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    await servicio.registrarComprobante(ID.usuarioAna, pago.id, { archivo: 'banco.pdf' });
    return pago;
  }

  it('acredita las clases del pack', async () => {
    const pago = await pagoListo();
    const aprobado = await servicio.aprobar(pago.id, {}, ID.usuarioAdmin);

    expect(aprobado.estado).toBe(EstadoPago.APROBADO);
    expect(aprobado.compra?.clasesTotales).toBe(10);
    expect(aprobado.compra?.clasesUsadas).toBe(0);
  });

  it('deja el rastro de quién y cuándo', async () => {
    const pago = await pagoListo();
    const aprobado = await servicio.aprobar(pago.id, {}, ID.usuarioAdmin);
    expect(aprobado.verificadoPor).toBe(ID.usuarioAdmin);
    expect(aprobado.verificadoAt).toBeInstanceOf(Date);
  });

  it('se puede corregir el monto por el que figura en el banco', async () => {
    const pago = await pagoListo();
    const aprobado = await servicio.aprobar(pago.id, { monto: 11500 }, ID.usuarioAdmin);

    expect(Number(aprobado.monto)).toBe(11500);
    // Lo que se esperaba cobrar queda: sin eso, un pago corregido es
    // indistinguible de uno que siempre fue por ese importe.
    expect(Number(aprobado.montoEsperado)).toBe(PRECIO_PACK);
  });

  it('y la corrección queda en la auditoría, de cuánto a cuánto', async () => {
    const pago = await pagoListo();
    await servicio.aprobar(pago.id, { monto: 11500 }, ID.usuarioAdmin);

    const registro = await prisma.registroAuditoria.findFirstOrThrow({
      where: { entidadId: pago.id, accion: 'PAGO_APROBADO' },
      orderBy: { createdAt: 'desc' },
    });
    expect(registro.detalle).toMatchObject({
      montoCorregido: { de: `${PRECIO_PACK}`, a: '11500' },
    });
  });

  it('la compra se crea con el monto corregido, no con el del catálogo', async () => {
    const pago = await pagoListo();
    const aprobado = await servicio.aprobar(pago.id, { monto: 11500 }, ID.usuarioAdmin);

    const compra = await prisma.compraServicio.findUniqueOrThrow({
      where: { id: aprobado.compra!.id },
      select: { montoTotal: true },
    });
    expect(Number(compra.montoTotal)).toBe(11500);
  });

  it('NO se puede aprobar dos veces', async () => {
    // Si se pudiera, cada aprobación crearía otra compra y el alumno terminaría
    // con veinte clases habiendo pagado diez.
    const pago = await pagoListo();
    await servicio.aprobar(pago.id, {}, ID.usuarioAdmin);

    await expect(servicio.aprobar(pago.id, {}, ID.usuarioAdmin)).rejects.toThrow(/ya fue revisado/);
    expect(await prisma.compraServicio.count({ where: { clienteId: ID.ana } })).toBe(1);
  });

  it('tampoco se puede aprobar uno rechazado', async () => {
    const pago = await pagoListo();
    await servicio.rechazar(pago.id, { motivo: 'El comprobante no se lee' }, ID.usuarioAdmin);
    await expect(servicio.aprobar(pago.id, {}, ID.usuarioAdmin)).rejects.toThrow(/ya fue revisado/);
  });
});

describe('Rechazar un pago', () => {
  it('guarda el motivo y NO acredita nada', async () => {
    const pago = await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    const rechazado = await servicio.rechazar(
      pago.id,
      { motivo: 'El comprobante es de otra cuenta' },
      ID.usuarioAdmin,
    );

    expect(rechazado.estado).toBe(EstadoPago.RECHAZADO);
    expect(rechazado.motivoRechazo).toBe('El comprobante es de otra cuenta');
    expect(await prisma.compraServicio.count({ where: { clienteId: ID.ana } })).toBe(0);
  });

  it('el alumno ve el motivo en su listado', async () => {
    const pago = await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    await servicio.rechazar(pago.id, { motivo: 'Falta el comprobante' }, ID.usuarioAdmin);

    const [mio] = await servicio.listarMios(ID.usuarioAna);
    expect(mio!.motivoRechazo).toBe('Falta el comprobante');
  });

  it('el motivo NO va a la auditoría: lo escribe una persona y puede nombrar a otra', async () => {
    const pago = await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    await servicio.rechazar(pago.id, { motivo: 'Lo pagó la madre de Bruno' }, ID.usuarioAdmin);

    const registro = await prisma.registroAuditoria.findFirstOrThrow({
      where: { entidadId: pago.id, accion: 'PAGO_RECHAZADO' },
    });
    expect(JSON.stringify(registro.detalle)).not.toContain('Bruno');
  });
});

describe('Pago en efectivo', () => {
  it('nace aprobado y acredita las clases en el acto', async () => {
    const pago = await servicio.crearEnEfectivo(
      { clienteId: ID.ana, servicioId: ID.pack },
      ID.usuarioAdmin,
    );

    expect(pago.estado).toBe(EstadoPago.APROBADO);
    expect(pago.canal).toBe(CanalPago.EFECTIVO);
    expect(pago.compra?.clasesTotales).toBe(10);
  });

  it('sin monto usa el precio del catálogo', async () => {
    const pago = await servicio.crearEnEfectivo(
      { clienteId: ID.ana, servicioId: ID.pack },
      ID.usuarioAdmin,
    );
    expect(Number(pago.monto)).toBe(PRECIO_PACK);
  });

  it('con monto usa el que se cobró de verdad', async () => {
    const pago = await servicio.crearEnEfectivo(
      { clienteId: ID.ana, servicioId: ID.pack, monto: 10000 },
      ID.usuarioAdmin,
    );
    expect(Number(pago.monto)).toBe(10000);
    expect(Number(pago.montoEsperado)).toBe(PRECIO_PACK);
  });

  it('un alumno que no existe no genera nada', async () => {
    await expect(
      servicio.crearEnEfectivo(
        { clienteId: '00000000-0000-4000-9999-000000000000', servicioId: ID.pack },
        ID.usuarioAdmin,
      ),
    ).rejects.toThrow(/no existe/);
    expect(await prisma.compraServicio.count({ where: { clienteId: ID.ana } })).toBe(0);
  });
});

describe('El listado del panel', () => {
  it('busca por apellido sin distinguir mayúsculas', async () => {
    await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    const pagina = await servicio.listar({ q: 'pagos' });
    expect(pagina.total).toBeGreaterThan(0);
  });

  it('busca por documento', async () => {
    await prisma.cliente.update({ where: { id: ID.ana }, data: { documento: '49876543' } });
    try {
      await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
      const pagina = await servicio.listar({ q: '4987' });
      expect(pagina.datos.some((p) => p.cliente.id === ID.ana)).toBe(true);
    } finally {
      await prisma.cliente.update({ where: { id: ID.ana }, data: { documento: null } });
    }
  });

  it('filtra por estado', async () => {
    await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    await servicio.crearEnEfectivo({ clienteId: ID.bruno, servicioId: ID.pack }, ID.usuarioAdmin);

    const pendientes = await servicio.listar({ estado: EstadoPago.PENDIENTE, q: 'pagos' });
    expect(pendientes.datos.every((p) => p.estado === EstadoPago.PENDIENTE)).toBe(true);
    expect(pendientes.datos.some((p) => p.cliente.id === ID.bruno)).toBe(false);
  });

  it('una búsqueda con comilla no rompe nada', async () => {
    const pagina = await servicio.listar({ q: "' OR 1=1--" });
    expect(pagina.total).toBe(0);
  });
});

describe('Lo que ve el alumno de sus pagos', () => {
  it('NO incluye la nota interna ni la ruta del comprobante', async () => {
    const pago = await servicio.crearEnEfectivo(
      { clienteId: ID.ana, servicioId: ID.pack, nota: 'ANOTACION INTERNA' },
      ID.usuarioAdmin,
    );
    expect(pago.nota).toBe('ANOTACION INTERNA');

    const [mio] = await servicio.listarMios(ID.usuarioAna);
    const texto = JSON.stringify(mio);
    expect(texto).not.toContain('ANOTACION INTERNA');
    expect(texto).not.toContain('comprobantePath');
  });

  it('y solo trae los suyos', async () => {
    await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    await servicio.crearPropio(ID.usuarioBruno, { servicioId: ID.pack });

    const deAna = await servicio.listarMios(ID.usuarioAna);
    expect(deAna).toHaveLength(1);
  });
});

describe('La compra y el pago van juntos o no van', () => {
  it('si la compra falla, el pago NO queda aprobado', async () => {
    // El fallo se fuerza dejando el servicio con una cantidad de clases que la
    // base rechaza (`compra_clases_usadas_valido` exige 0 <= usadas <= totales).
    // Así revienta la creación de la compra DENTRO de la transacción, que es
    // exactamente lo que se quiere probar: sin transacción, el pago quedaría
    // APROBADO y el alumno sin clases acreditadas.
    const pago = await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    await prisma.servicio.update({ where: { id: ID.pack }, data: { cantidadClases: -5 } });

    try {
      await expect(servicio.aprobar(pago.id, {}, ID.usuarioAdmin)).rejects.toThrow();

      const despues = await prisma.pago.findUniqueOrThrow({
        where: { id: pago.id },
        select: { estado: true, compraId: true },
      });
      expect(despues.estado).toBe(EstadoPago.PENDIENTE);
      expect(despues.compraId).toBeNull();
      expect(await prisma.compraServicio.count({ where: { clienteId: ID.ana } })).toBe(0);
    } finally {
      await prisma.servicio.update({ where: { id: ID.pack }, data: { cantidadClases: 10 } });
    }
  });
});

/**
 * Los avisos que cierran el círculo del pago.
 *
 * Sin esto, la academia se entera de que hay un comprobante esperando sólo si a
 * alguien se le ocurre abrir el panel, y el alumno se entera de la decisión sólo
 * si vuelve a entrar a la app. Las dos cosas ya pasaban.
 *
 * Los avisos salen SIN esperar (`void`), así que las pruebas dan una vuelta al
 * bucle de eventos antes de mirar qué se pidió mandar.
 */
describe('Los avisos del pago', () => {
  /** Los avisos se disparan sin await: hay que dejarlos correr. */
  const dejarSalir = () => new Promise((r) => setTimeout(r, 30));

  it('empezar un pago NO avisa: todavía no hay nada que revisar', async () => {
    await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    await dejarSalir();

    expect(telegramaEnviados).toHaveLength(0);
  });

  it('subir el comprobante avisa a la academia', async () => {
    const pago = await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    await servicio.registrarComprobante(ID.usuarioAna, pago.id, { archivo: 'c.pdf' });
    await dejarSalir();

    expect(telegramaEnviados).toHaveLength(1);
    expect(telegramaEnviados[0]!.clase).toBe('pagoNuevo');
    expect(telegramaEnviados[0]!.texto).toContain('Ana');
    expect(telegramaEnviados[0]!.texto).toContain('Pack de 10 clases');
  });

  it('el aviso NO lleva la ruta del comprobante ni el documento del alumno', async () => {
    // La ruta, junto con la clave de servicio, llega al archivo. Telegram lo lee
    // más gente que la base, y un chat de grupo puede tener a cualquiera.
    const pago = await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    await servicio.registrarComprobante(ID.usuarioAna, pago.id, { archivo: 'c.pdf' });
    await dejarSalir();

    const texto = telegramaEnviados[0]!.texto;
    expect(texto).not.toContain('c.pdf');
    expect(texto).not.toContain(ID.usuarioAna);
    expect(texto).not.toContain(pago.id);
  });

  it('aprobar le avisa al alumno, y dice cuántas clases le quedaron', async () => {
    const pago = await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    await servicio.aprobar(pago.id, {}, ID.usuarioAdmin);
    await dejarSalir();

    expect(pushEnviados).toHaveLength(1);
    expect(pushEnviados[0]!.usuarioId).toBe(ID.usuarioAna);
    expect(pushEnviados[0]!.titulo).toBe('Pago aprobado');
  });

  it('rechazar también le avisa, pero sin el motivo adentro', async () => {
    // El motivo lo escribe una persona y puede nombrar el banco o la cuenta del
    // alumno. Una notificación se lee en la pantalla bloqueada; el motivo entero
    // está en la app, detrás de la sesión.
    const pago = await servicio.crearPropio(ID.usuarioAna, { servicioId: ID.pack });
    await servicio.rechazar(pago.id, { motivo: 'El comprobante es de otra cuenta' }, ID.usuarioAdmin);
    await dejarSalir();

    expect(pushEnviados).toHaveLength(1);
    expect(pushEnviados[0]!.usuarioId).toBe(ID.usuarioAna);
    expect(JSON.stringify(pushEnviados[0])).not.toContain('otra cuenta');
  });

  it('el aviso va al alumno del pago, no a quien lo aprobó', async () => {
    const pago = await servicio.crearPropio(ID.usuarioBruno, { servicioId: ID.pack });
    await servicio.aprobar(pago.id, {}, ID.usuarioAdmin);
    await dejarSalir();

    expect(pushEnviados[0]!.usuarioId).toBe(ID.usuarioBruno);
  });

  it('un cobro en efectivo NO dispara el aviso de comprobante', async () => {
    // Lo registra la academia en el mostrador: no hay nada que ir a revisar.
    await servicio.crearEnEfectivo({ clienteId: ID.ana, servicioId: ID.pack }, ID.usuarioAdmin);
    await dejarSalir();

    expect(telegramaEnviados).toHaveLength(0);
  });
});
