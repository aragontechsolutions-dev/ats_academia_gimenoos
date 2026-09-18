/**
 * El tablero del panel.
 *
 * Lo que se prueba acá no es «que sume»: es que sume **lo que corresponde**. Un
 * tablero que muestra un número equivocado es peor que uno que no existe,
 * porque nadie lo va a verificar contra la base antes de cerrar la caja.
 *
 * Los tres riesgos concretos:
 *  - que cuente plata que todavía no entró (un pago pendiente sumado al cobrado);
 *  - que un pago de las once de la noche caiga en el día siguiente por contar en
 *    UTC en vez de en la hora de San Carlos;
 *  - que los pendientes de revisión se filtren por período y desaparezcan de la
 *    cola por el solo hecho de mirar «hoy».
 *
 * Todo el escenario vive en marzo de 2020 para no cruzarse con los datos de las
 * otras pruebas ni con el mes en curso.
 */
import { CanalPago, EstadoPago, EstadoReserva, TipoServicio, TipoVehiculo } from '@prisma/client';

import { PrismaService } from '../src/common/prisma/prisma.service';
import { TableroService } from '../src/modules/tablero/tablero.service';

const prisma = new PrismaService();
const tablero = new TableroService(prisma);

const ID = {
  usuario: '00000000-0000-4000-e200-000000000001',
  cliente: '00000000-0000-4000-e200-00000000000a',
  instructorAna: '00000000-0000-4000-e200-0000000000b1',
  instructorBruno: '00000000-0000-4000-e200-0000000000b2',
  servicio: '00000000-0000-4000-e200-0000000000d1',
};

/** El período de prueba: del 2 al 4 de marzo de 2020, tres días. */
const DESDE = '2020-03-02';
const HASTA = '2020-03-04';

/** Un instante de Montevideo escrito como el UTC que le corresponde (UTC-3). */
const enMontevideo = (dia: string, hora: string) => new Date(`${dia}T${hora}:00-03:00`);

async function limpiar() {
  await prisma.pago.deleteMany({ where: { clienteId: ID.cliente } });
  await prisma.reserva.deleteMany({ where: { clienteId: ID.cliente } });
  await prisma.compraServicio.deleteMany({ where: { clienteId: ID.cliente } });
}

beforeAll(async () => {
  await prisma.$connect();

  await prisma.usuario.upsert({
    where: { id: ID.usuario },
    update: {},
    create: { id: ID.usuario, email: 'tablero@local', nombre: 'Tablero', apellido: 'Prueba' },
  });
  await prisma.cliente.upsert({
    where: { id: ID.cliente },
    update: {},
    create: { id: ID.cliente, usuarioId: ID.usuario, nombre: 'Tablero', apellido: 'Prueba' },
  });
  for (const [id, nombre] of [
    [ID.instructorAna, 'Ana'],
    [ID.instructorBruno, 'Bruno'],
  ]) {
    await prisma.instructor.upsert({
      where: { id: id! },
      update: {},
      create: { id: id!, nombre: nombre!, apellido: 'Tablero' },
    });
  }
  await prisma.servicio.upsert({
    where: { id: ID.servicio },
    update: {},
    create: {
      id: ID.servicio,
      slug: 'servicio-tablero-prueba',
      nombre: 'Clase suelta de prueba',
      tipo: TipoServicio.CLASE_SUELTA,
      cantidadClases: 1,
      precioContado: 1000,
      precioTarjeta: 1100,
    },
  });
});

beforeEach(limpiar);

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

/** Crea un pago con una fecha puesta a mano, que es lo que hace medible al tablero. */
function pago(datos: {
  monto: number;
  canal: CanalPago;
  estado: EstadoPago;
  cuando: Date;
  servicio?: boolean;
}) {
  return prisma.pago.create({
    data: {
      clienteId: ID.cliente,
      servicioId: datos.servicio === false ? null : ID.servicio,
      monto: datos.monto,
      canal: datos.canal,
      estado: datos.estado,
      createdAt: datos.cuando,
    },
  });
}

function clase(datos: { instructorId: string; estado: EstadoReserva; inicio: Date }) {
  return prisma.reserva.create({
    data: {
      clienteId: ID.cliente,
      instructorId: datos.instructorId,
      tipo: TipoVehiculo.AUTO,
      estado: datos.estado,
      inicio: datos.inicio,
      fin: new Date(datos.inicio.getTime() + 45 * 60_000),
    },
  });
}

const resumen = () => tablero.resumen({ desde: DESDE, hasta: HASTA });

/**
 * La cola de revisión, medida directo en la base.
 *
 * Los pendientes NO se filtran por período —esa es justamente la decisión que
 * hay que proteger—, así que cualquier pago sin revisar que haya dejado otra
 * prueba cuenta igual. Comparar contra un número fijo haría que estas pruebas
 * fallaran según el orden en que corren, que es la peor clase de prueba: la que
 * enseña a ignorar el rojo. Se compara contra la verdad de la base.
 */
async function colaReal() {
  const pendientes = await prisma.pago.findMany({
    where: { estado: { in: [EstadoPago.PENDIENTE, EstadoPago.PENDIENTE_VERIFICACION] } },
    select: { monto: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return {
    cantidad: pendientes.length,
    monto: pendientes.reduce((total, p) => total + Number(p.monto), 0),
    masViejo: pendientes[0]?.createdAt ?? null,
  };
}

describe('La plata que entró', () => {
  it('suma solo los pagos aprobados, separados por forma de pago', async () => {
    await pago({ monto: 1000, canal: CanalPago.TRANSFERENCIA, estado: EstadoPago.APROBADO, cuando: enMontevideo(DESDE, '10:00') });
    await pago({ monto: 500, canal: CanalPago.TRANSFERENCIA, estado: EstadoPago.APROBADO, cuando: enMontevideo(DESDE, '11:00') });
    await pago({ monto: 2000, canal: CanalPago.EFECTIVO, estado: EstadoPago.APROBADO, cuando: enMontevideo(DESDE, '12:00') });

    const datos = await resumen();

    expect(datos.cobrado.total).toBe('3500.00');
    expect(datos.cobrado.cantidad).toBe(3);
    const porCanal = Object.fromEntries(datos.cobrado.porCanal.map((f) => [f.canal, f.monto]));
    expect(porCanal[CanalPago.TRANSFERENCIA]).toBe('1500.00');
    expect(porCanal[CanalPago.EFECTIVO]).toBe('2000.00');
  });

  it('NO cuenta como cobrado lo que está esperando revisión', async () => {
    const antes = await colaReal();
    await pago({ monto: 9999, canal: CanalPago.TRANSFERENCIA, estado: EstadoPago.PENDIENTE_VERIFICACION, cuando: enMontevideo(DESDE, '10:00') });

    const datos = await resumen();

    expect(datos.cobrado.total).toBe('0.00');
    expect(datos.pendientes.cantidad).toBe(antes.cantidad + 1);
  });

  it('tampoco cuenta lo rechazado, pero lo informa aparte', async () => {
    await pago({ monto: 700, canal: CanalPago.TRANSFERENCIA, estado: EstadoPago.RECHAZADO, cuando: enMontevideo(DESDE, '10:00') });

    const datos = await resumen();

    expect(datos.cobrado.total).toBe('0.00');
    expect(datos.rechazados).toBe(1);
  });

  it('los montos viajan como texto: un total grande no pierde centavos', async () => {
    await pago({ monto: 1234567.89, canal: CanalPago.EFECTIVO, estado: EstadoPago.APROBADO, cuando: enMontevideo(DESDE, '10:00') });

    const datos = await resumen();

    expect(typeof datos.cobrado.total).toBe('string');
    expect(datos.cobrado.total).toBe('1234567.89');
  });
});

describe('La cola de pagos por revisar', () => {
  /**
   * Esta es la que más importa de las tres: si los pendientes se filtraran por
   * período, un comprobante de hace un mes dejaría de aparecer al mirar «hoy» y
   * el alumno se quedaría esperando sin que nadie se entere.
   */
  it('no se filtra por período: un pendiente muy anterior sigue apareciendo', async () => {
    const antes = await colaReal();
    // Enero de 2019 está lejísimos del período consultado (marzo de 2020). Si
    // los pendientes se filtraran por fecha, este no aparecería.
    await pago({ monto: 800, canal: CanalPago.TRANSFERENCIA, estado: EstadoPago.PENDIENTE_VERIFICACION, cuando: enMontevideo('2019-01-15', '10:00') });

    const datos = await resumen();

    expect(datos.pendientes.cantidad).toBe(antes.cantidad + 1);
    expect(Number(datos.pendientes.monto)).toBeCloseTo(antes.monto + 800, 2);
  });

  it('informa desde cuándo espera el más viejo de todos', async () => {
    // 1970: más viejo que cualquier cosa que pueda dejar otra prueba.
    const viejo = enMontevideo('1970-02-03', '10:00');
    await pago({ monto: 100, canal: CanalPago.TRANSFERENCIA, estado: EstadoPago.PENDIENTE, cuando: enMontevideo(DESDE, '10:00') });
    await pago({ monto: 200, canal: CanalPago.TRANSFERENCIA, estado: EstadoPago.PENDIENTE_VERIFICACION, cuando: viejo });

    const datos = await resumen();

    expect(datos.pendientes.desdeCuando?.toISOString()).toBe(viejo.toISOString());
  });

  it('la fecha que informa es siempre la del más viejo que hay en la base', async () => {
    // Y si no hay ninguno, no inventa una: devuelve null.
    const cola = await colaReal();
    const datos = await resumen();

    expect(datos.pendientes.cantidad).toBe(cola.cantidad);
    expect(datos.pendientes.desdeCuando?.toISOString() ?? null).toBe(
      cola.masViejo?.toISOString() ?? null,
    );
  });
});

describe('Las clases', () => {
  it('cuenta como dictadas solo las completadas, y separa el resto', async () => {
    await clase({ instructorId: ID.instructorAna, estado: EstadoReserva.COMPLETADA, inicio: enMontevideo(DESDE, '09:00') });
    await clase({ instructorId: ID.instructorAna, estado: EstadoReserva.COMPLETADA, inicio: enMontevideo(DESDE, '10:00') });
    await clase({ instructorId: ID.instructorAna, estado: EstadoReserva.CONFIRMADA, inicio: enMontevideo(DESDE, '11:00') });
    await clase({ instructorId: ID.instructorAna, estado: EstadoReserva.CANCELADA, inicio: enMontevideo(DESDE, '12:00') });
    await clase({ instructorId: ID.instructorAna, estado: EstadoReserva.AUSENTE, inicio: enMontevideo(DESDE, '13:00') });

    const datos = await resumen();

    expect(datos.clases.dictadas).toBe(2);
    expect(datos.clases.agendadas).toBe(1);
    expect(datos.clases.canceladas).toBe(1);
    expect(datos.clases.ausentes).toBe(1);
  });

  it('cuenta por la hora de la clase, no por cuándo se agendó', async () => {
    // Agendada hoy, pero para un día fuera del período: no es del período.
    await clase({ instructorId: ID.instructorAna, estado: EstadoReserva.COMPLETADA, inicio: enMontevideo('2020-04-20', '09:00') });

    const datos = await resumen();

    expect(datos.clases.dictadas).toBe(0);
  });

  it('reparte las dictadas por instructor, de mayor a menor', async () => {
    await clase({ instructorId: ID.instructorAna, estado: EstadoReserva.COMPLETADA, inicio: enMontevideo(DESDE, '09:00') });
    await clase({ instructorId: ID.instructorAna, estado: EstadoReserva.COMPLETADA, inicio: enMontevideo(DESDE, '10:00') });
    await clase({ instructorId: ID.instructorBruno, estado: EstadoReserva.COMPLETADA, inicio: enMontevideo(DESDE, '09:00') });

    const datos = await resumen();

    expect(datos.porInstructor).toEqual([
      { instructor: 'Ana Tablero', clases: 2 },
      { instructor: 'Bruno Tablero', clases: 1 },
    ]);
  });
});

describe('La hora de San Carlos, no la de Greenwich', () => {
  /**
   * Uruguay está en UTC-3: las 23:30 del 2 de marzo acá son las 02:30 del 3 en
   * UTC. Agrupando por día UTC, ese pago aparecería al día siguiente y el corte
   * diario no cerraría contra la caja.
   */
  it('un pago de las 23:30 cuenta en el día de Montevideo', async () => {
    await pago({ monto: 400, canal: CanalPago.EFECTIVO, estado: EstadoPago.APROBADO, cuando: enMontevideo(DESDE, '23:30') });

    const datos = await resumen();
    const dia = datos.dias.find((d) => d.dia === DESDE);

    expect(dia?.cobrado).toBe('400.00');
    expect(datos.dias.find((d) => d.dia === '2020-03-03')?.cobrado).toBe('0');
  });

  it('una clase de las 23:30 cuenta en el día de Montevideo', async () => {
    await clase({ instructorId: ID.instructorAna, estado: EstadoReserva.COMPLETADA, inicio: enMontevideo(DESDE, '23:30') });

    const datos = await resumen();

    expect(datos.dias.find((d) => d.dia === DESDE)?.clases).toBe(1);
    expect(datos.dias.find((d) => d.dia === '2020-03-03')?.clases).toBe(0);
  });
});

describe('La serie diaria', () => {
  it('trae un renglón por cada día del período, incluidos los vacíos', async () => {
    await pago({ monto: 100, canal: CanalPago.EFECTIVO, estado: EstadoPago.APROBADO, cuando: enMontevideo(HASTA, '10:00') });

    const datos = await resumen();

    expect(datos.dias.map((d) => d.dia)).toEqual(['2020-03-02', '2020-03-03', '2020-03-04']);
    expect(datos.dias[1]!.cobrado).toBe('0');
    expect(datos.dias[2]!.cobrado).toBe('100.00');
  });

  it('el último día es inclusivo: lo del 4 a las 23:59 entra', async () => {
    await pago({ monto: 50, canal: CanalPago.EFECTIVO, estado: EstadoPago.APROBADO, cuando: enMontevideo(HASTA, '23:59') });

    const datos = await resumen();

    expect(datos.cobrado.total).toBe('50.00');
  });

  it('y lo del día siguiente NO entra', async () => {
    await pago({ monto: 50, canal: CanalPago.EFECTIVO, estado: EstadoPago.APROBADO, cuando: enMontevideo('2020-03-05', '00:01') });

    const datos = await resumen();

    expect(datos.cobrado.total).toBe('0.00');
  });
});

describe('El período que se pide', () => {
  it('sin parámetros, mira el mes en curso', async () => {
    const datos = await tablero.resumen({});

    expect(datos.periodo.desde).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it('rechaza un final anterior al inicio', async () => {
    await expect(tablero.resumen({ desde: '2020-03-10', hasta: '2020-03-01' })).rejects.toThrow(
      /posterior/i,
    );
  });

  it('rechaza un período absurdamente largo: es una consulta que recorre todo', async () => {
    await expect(tablero.resumen({ desde: '1990-01-01', hasta: '2020-01-01' })).rejects.toThrow(
      /período no puede pasar/i,
    );
  });

  it('devuelve el período tal como se pidió, con el final inclusivo', async () => {
    const datos = await resumen();

    expect(datos.periodo).toEqual({ desde: DESDE, hasta: HASTA });
  });
});

describe('Lo que se vendió', () => {
  it('agrupa lo cobrado por servicio', async () => {
    await pago({ monto: 1000, canal: CanalPago.EFECTIVO, estado: EstadoPago.APROBADO, cuando: enMontevideo(DESDE, '10:00') });
    await pago({ monto: 1000, canal: CanalPago.TRANSFERENCIA, estado: EstadoPago.APROBADO, cuando: enMontevideo(DESDE, '11:00') });

    const datos = await resumen();
    const fila = datos.porServicio.find((f) => f.servicio === 'Clase suelta de prueba');

    expect(fila).toEqual({ servicio: 'Clase suelta de prueba', monto: '2000.00', cantidad: 2 });
  });

  it('un pago sin servicio no rompe el agrupado', async () => {
    await pago({ monto: 300, canal: CanalPago.EFECTIVO, estado: EstadoPago.APROBADO, cuando: enMontevideo(DESDE, '10:00'), servicio: false });

    const datos = await resumen();

    expect(datos.cobrado.total).toBe('300.00');
    expect(datos.porServicio.some((f) => f.servicio === 'Clase suelta de prueba')).toBe(false);
  });
});

describe('Las clases compradas que todavía no se dieron', () => {
  it('cuenta el saldo de las compras abiertas', async () => {
    await prisma.compraServicio.create({
      data: {
        clienteId: ID.cliente,
        servicioId: ID.servicio,
        clasesTotales: 10,
        clasesUsadas: 4,
        montoTotal: 10000,
      },
    });

    const antes = await resumen();
    expect(antes.clases.sinUsar).toBeGreaterThanOrEqual(6);

    await limpiar();
    const despues = await resumen();
    expect(despues.clases.sinUsar).toBe(antes.clases.sinUsar - 6);
  });
});
