/**
 * El envío de recordatorios, contra la base real.
 *
 * Lo que se prueba acá y no se puede probar sin base: que **un recordatorio no
 * salga dos veces**. La garantía es una clave única, así que hace falta la base
 * de verdad para comprobarla.
 */
import { CanalRecordatorio, EstadoReserva, TipoRecordatorio, TipoVehiculo } from '@prisma/client';

import { PrismaService } from '../src/common/prisma/prisma.service';
import type { TelegramService, ResultadoDeAviso } from '../src/common/telegram/telegram.service';
import { RecordatoriosService } from '../src/modules/recordatorios/recordatorios.service';

const prisma = new PrismaService();

const ID = {
  usuario: '00000000-0000-4000-d100-000000000001',
  cliente: '00000000-0000-4000-d100-00000000000a',
  instructor: '00000000-0000-4000-d100-0000000000e1',
  vehiculo: '00000000-0000-4000-d100-0000000000f1',
  reserva: '00000000-0000-4000-d100-000000000031',
  reservaTardia: '00000000-0000-4000-d100-000000000032',
};

/** La clase es a las 14:00 de Uruguay del 18/09/2026. */
const INICIO = new Date('2026-09-18T17:00:00.000Z');
const hs = (n: number) => n * 60 * 60 * 1000;

/** Un Telegram de mentira, con el resultado que cada prueba necesita. */
function telegramFalso(resultado: ResultadoDeAviso = { estado: 'enviado' }) {
  const mandados: string[] = [];
  const servicio = {
    avisar: async (_clase: string, texto: string) => {
      mandados.push(texto);
      return resultado;
    },
  } as unknown as TelegramService;
  return { servicio, mandados };
}

async function crearReserva(id: string, createdAt: Date) {
  await prisma.reserva.deleteMany({ where: { id } });
  await prisma.reserva.create({
    data: {
      id,
      clienteId: ID.cliente,
      instructorId: ID.instructor,
      vehiculoId: ID.vehiculo,
      tipo: TipoVehiculo.AUTO,
      inicio: INICIO,
      fin: new Date(INICIO.getTime() + 45 * 60 * 1000),
      estado: EstadoReserva.CONFIRMADA,
      createdAt,
    },
  });
}

beforeAll(async () => {
  await prisma.$connect();
  await prisma.usuario.upsert({
    where: { id: ID.usuario },
    update: {},
    create: { id: ID.usuario, email: 'rec-test@local', nombre: 'Rec', apellido: 'Test' },
  });
  await prisma.cliente.upsert({
    where: { id: ID.cliente },
    update: {},
    create: {
      id: ID.cliente,
      usuarioId: ID.usuario,
      nombre: 'Lautaro',
      apellido: 'Recordatorio',
      telefono: '+598 92331784',
    },
  });
  await prisma.instructor.upsert({
    where: { id: ID.instructor },
    update: {},
    create: { id: ID.instructor, nombre: 'Marta', apellido: 'Instructora', habilitaAuto: true },
  });
  await prisma.vehiculo.upsert({
    where: { id: ID.vehiculo },
    update: {},
    create: { id: ID.vehiculo, patente: 'REC1234', tipo: TipoVehiculo.AUTO },
  });
});

beforeEach(async () => {
  await prisma.recordatorioEnviado.deleteMany({
    where: { reservaId: { in: [ID.reserva, ID.reservaTardia] } },
  });
  // Reservada con una semana de antelación: le corresponden los dos avisos.
  await crearReserva(ID.reserva, new Date(INICIO.getTime() - hs(24 * 7)));
});

afterAll(async () => {
  await prisma.recordatorioEnviado.deleteMany({
    where: { reservaId: { in: [ID.reserva, ID.reservaTardia] } },
  });
  await prisma.reserva.deleteMany({ where: { id: { in: [ID.reserva, ID.reservaTardia] } } });
  await prisma.vehiculo.deleteMany({ where: { id: ID.vehiculo } });
  await prisma.instructor.deleteMany({ where: { id: ID.instructor } });
  await prisma.cliente.deleteMany({ where: { id: ID.cliente } });
  await prisma.usuario.deleteMany({ where: { id: ID.usuario } });
  await prisma.$disconnect();
});

describe('una pasada de recordatorios', () => {
  it('manda el de 24 horas cuando toca', async () => {
    const { servicio, mandados } = telegramFalso();
    const recordatorios = new RecordatoriosService(prisma, servicio);

    const resumen = await recordatorios.procesar(new Date(INICIO.getTime() - hs(23)));

    expect(resumen.enviados).toBe(1);
    expect(mandados[0]).toContain('Clase mañana');
    expect(mandados[0]).toContain('Lautaro Recordatorio');
  });

  it('NO lo manda dos veces, aunque se llame de nuevo', async () => {
    // Es la razón de ser de la clave única: el disparador es externo y puede
    // llamar dos veces —un reintento, dos ejecuciones que se pisan—.
    const { servicio, mandados } = telegramFalso();
    const recordatorios = new RecordatoriosService(prisma, servicio);
    const ahora = new Date(INICIO.getTime() - hs(23));

    await recordatorios.procesar(ahora);
    const segunda = await recordatorios.procesar(ahora);

    expect(segunda.enviados).toBe(0);
    expect(segunda.repetidos).toBe(1);
    expect(mandados).toHaveLength(1);
  });

  it('ni siquiera si las dos pasadas corren a la vez', async () => {
    const { servicio, mandados } = telegramFalso();
    const recordatorios = new RecordatoriosService(prisma, servicio);
    const ahora = new Date(INICIO.getTime() - hs(23));

    await Promise.all([recordatorios.procesar(ahora), recordatorios.procesar(ahora)]);

    expect(mandados).toHaveLength(1);
  });

  it('el de 2 horas es otro recordatorio: sale aunque ya haya salido el de 24', async () => {
    const { servicio, mandados } = telegramFalso();
    const recordatorios = new RecordatoriosService(prisma, servicio);

    await recordatorios.procesar(new Date(INICIO.getTime() - hs(23)));
    const segunda = await recordatorios.procesar(new Date(INICIO.getTime() - hs(1.5)));

    expect(segunda.enviados).toBe(1);
    expect(mandados).toHaveLength(2);
    expect(mandados[1]).toContain('Clase en un rato');
  });

  it('una clase cancelada no se recuerda', async () => {
    await prisma.reserva.update({
      where: { id: ID.reserva },
      data: { estado: EstadoReserva.CANCELADA },
    });
    const { servicio, mandados } = telegramFalso();
    const recordatorios = new RecordatoriosService(prisma, servicio);

    const resumen = await recordatorios.procesar(new Date(INICIO.getTime() - hs(23)));

    expect(resumen.enviados).toBe(0);
    expect(mandados).toHaveLength(0);
  });

  it('una clase que ya empezó tampoco', async () => {
    const { servicio, mandados } = telegramFalso();
    const recordatorios = new RecordatoriosService(prisma, servicio);

    await recordatorios.procesar(new Date(INICIO.getTime() + hs(1)));

    expect(mandados).toHaveLength(0);
  });
});

describe('cuando el aviso no sale', () => {
  it('si falla, queda anotado con el motivo y NO se reintenta en bucle', async () => {
    const { servicio } = telegramFalso({ estado: 'fallo', motivo: 'chat not found' });
    const recordatorios = new RecordatoriosService(prisma, servicio);
    const ahora = new Date(INICIO.getTime() - hs(23));

    const primera = await recordatorios.procesar(ahora);
    expect(primera.fallidos).toBe(1);

    const anotado = await prisma.recordatorioEnviado.findUnique({
      where: {
        reservaId_tipo_canal: {
          reservaId: ID.reserva,
          tipo: TipoRecordatorio.VEINTICUATRO_HORAS,
          canal: CanalRecordatorio.TELEGRAM,
        },
      },
    });
    expect(anotado?.entregado).toBe(false);
    expect(anotado?.error).toBe('chat not found');

    // La pasada siguiente lo ve anotado y no vuelve a intentar.
    const segunda = await recordatorios.procesar(ahora);
    expect(segunda.fallidos).toBe(0);
    expect(segunda.repetidos).toBe(1);
  });

  it('si NO correspondía mandarlo, no queda anotado: configurar el bot mañana tiene que servir', async () => {
    // Sin bot configurado, o con el aviso apagado, anotar el recordatorio dejaría
    // las clases de mañana marcadas como avisadas sin que nadie recibiera nada.
    const { servicio } = telegramFalso({ estado: 'omitido' });
    const recordatorios = new RecordatoriosService(prisma, servicio);
    const ahora = new Date(INICIO.getTime() - hs(23));

    const resumen = await recordatorios.procesar(ahora);
    expect(resumen.omitidos).toBe(1);
    expect(await prisma.recordatorioEnviado.count({ where: { reservaId: ID.reserva } })).toBe(0);

    // Y con el bot ya configurado, el mismo recordatorio sale.
    const { servicio: conBot, mandados } = telegramFalso();
    await new RecordatoriosService(prisma, conBot).procesar(ahora);
    expect(mandados).toHaveLength(1);
  });
});

describe('quien reserva sobre la hora', () => {
  it('no recibe el recordatorio de 24 horas', async () => {
    // Primero se borra la otra: la restriccion anti-doble-reserva no deja dos
    // clases del mismo instructor en el mismo horario, que es justamente lo que
    // tiene que hacer.
    await prisma.reserva.deleteMany({ where: { id: ID.reserva } });
    await crearReserva(ID.reservaTardia, new Date(INICIO.getTime() - hs(3)));

    const { servicio, mandados } = telegramFalso();
    const recordatorios = new RecordatoriosService(prisma, servicio);

    await recordatorios.procesar(new Date(INICIO.getTime() - hs(2.5)));
    expect(mandados).toHaveLength(0);

    // Pero el de 2 horas sí le llega.
    await recordatorios.procesar(new Date(INICIO.getTime() - hs(1.5)));
    expect(mandados).toHaveLength(1);
    expect(mandados[0]).toContain('Clase en un rato');
  });
});
