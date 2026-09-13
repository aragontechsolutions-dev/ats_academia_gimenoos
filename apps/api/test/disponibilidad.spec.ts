/**
 * Pruebas del motor de disponibilidad.
 *
 * Corren contra una base real porque el motor combina consultas, aritmética de
 * zonas horarias y las reservas existentes: simular todo eso probaría el simulador.
 */
import { TipoExcepcion, TipoVehiculo, EstadoReserva, EstadoVehiculo } from '@prisma/client';
import { DateTime } from 'luxon';

import { PrismaService } from '../src/common/prisma/prisma.service';
import { DisponibilidadService } from '../src/modules/agenda/disponibilidad.service';

const prisma = new PrismaService();
const servicio = new DisponibilidadService(prisma);

/**
 * El motor mira TODOS los instructores y vehículos activos de la base, que es
 * justo lo que debe hacer. Para que estas pruebas midan solo lo que declaran,
 * el resto se desactiva mientras corren y se restaura al terminar.
 */
const desactivadosTemporalmente = { instructores: [] as string[], vehiculos: [] as string[] };

const ID = {
  usuario: '00000000-0000-4000-b000-000000000001',
  cliente: '00000000-0000-4000-b000-000000000002',
  instructor: '00000000-0000-4000-b000-00000000000a',
  instructorSoloMoto: '00000000-0000-4000-b000-00000000000b',
  auto: '00000000-0000-4000-b000-0000000000f1',
  moto: '00000000-0000-4000-b000-0000000000f2',
};

/** Un lunes lejano, para no chocar con datos de desarrollo. */
const LUNES = DateTime.fromObject(
  { year: 2030, month: 1, day: 7 },
  { zone: 'America/Montevideo' },
).startOf('day');

/** "Ahora" fijo: el viernes anterior, así la antelación mínima nunca recorta el lunes. */
const AHORA = LUNES.minus({ days: 3 }).toJSDate();

const DURACION = 45;

const rangoDelLunes = () => ({
  desde: LUNES.toJSDate(),
  hasta: LUNES.endOf('day').toJSDate(),
});

/** Horas locales de los huecos devueltos, para leer las aserciones de un vistazo. */
const horasLocales = (huecos: Array<{ inicio: Date }>) =>
  huecos.map((h) => DateTime.fromJSDate(h.inicio).setZone('America/Montevideo').toFormat('HH:mm'));

beforeAll(async () => {
  await prisma.$connect();

  // La plantilla se interpreta en hora local: si el lunes elegido no fuera lunes,
  // la prueba estaría midiendo otra cosa.
  expect(LUNES.weekday).toBe(1);

  await prisma.configuracionAcademia.upsert({
    where: { id: 1 },
    update: { bufferMinutos: 15, antelacionMinimaHoras: 12, ventanaReservaDias: 30 },
    create: { id: 1, bufferMinutos: 15, antelacionMinimaHoras: 12, ventanaReservaDias: 30 },
  });

  await prisma.usuario.upsert({
    where: { id: ID.usuario },
    update: {},
    create: { id: ID.usuario, email: 'disp@local', nombre: 'Disp', apellido: 'Test' },
  });
  await prisma.cliente.upsert({
    where: { id: ID.cliente },
    update: {},
    create: { id: ID.cliente, usuarioId: ID.usuario },
  });

  await prisma.instructor.upsert({
    where: { id: ID.instructor },
    update: { activo: true, habilitaAuto: true, habilitaMoto: true },
    create: {
      id: ID.instructor,
      nombre: 'Ana',
      apellido: 'Disponible',
      habilitaAuto: true,
      habilitaMoto: true,
    },
  });
  await prisma.instructor.upsert({
    where: { id: ID.instructorSoloMoto },
    update: { activo: true, habilitaAuto: false, habilitaMoto: true },
    create: {
      id: ID.instructorSoloMoto,
      nombre: 'Beto',
      apellido: 'SoloMoto',
      habilitaAuto: false,
      habilitaMoto: true,
    },
  });

  await prisma.vehiculo.upsert({
    where: { id: ID.auto },
    update: { estado: EstadoVehiculo.ACTIVO },
    create: { id: ID.auto, patente: 'DISPA1', tipo: TipoVehiculo.AUTO },
  });
  await prisma.vehiculo.upsert({
    where: { id: ID.moto },
    update: { estado: EstadoVehiculo.ACTIVO },
    create: { id: ID.moto, patente: 'DISPM1', tipo: TipoVehiculo.MOTO, cilindrada: 125 },
  });

  const mios = { instructores: [ID.instructor, ID.instructorSoloMoto], vehiculos: [ID.auto, ID.moto] };

  const otrosInstructores = await prisma.instructor.findMany({
    where: { activo: true, id: { notIn: mios.instructores } },
    select: { id: true },
  });
  desactivadosTemporalmente.instructores = otrosInstructores.map((i) => i.id);
  await prisma.instructor.updateMany({
    where: { id: { in: desactivadosTemporalmente.instructores } },
    data: { activo: false },
  });

  const otrosVehiculos = await prisma.vehiculo.findMany({
    where: { estado: EstadoVehiculo.ACTIVO, id: { notIn: mios.vehiculos } },
    select: { id: true },
  });
  desactivadosTemporalmente.vehiculos = otrosVehiculos.map((v) => v.id);
  await prisma.vehiculo.updateMany({
    where: { id: { in: desactivadosTemporalmente.vehiculos } },
    data: { estado: EstadoVehiculo.BAJA },
  });
});

beforeEach(async () => {
  await prisma.reserva.deleteMany({ where: { clienteId: ID.cliente } });
  await prisma.excepcionDisponibilidad.deleteMany({
    where: { instructorId: { in: [ID.instructor, ID.instructorSoloMoto] } },
  });
  await prisma.disponibilidadPlantilla.deleteMany({
    where: { instructorId: { in: [ID.instructor, ID.instructorSoloMoto] } },
  });

  // Lunes de 9 a 13, hora de Montevideo.
  await prisma.disponibilidadPlantilla.create({
    data: { instructorId: ID.instructor, diaSemana: 1, minutoInicio: 9 * 60, minutoFin: 13 * 60 },
  });
  await prisma.vehiculo.update({
    where: { id: ID.auto },
    data: { estado: EstadoVehiculo.ACTIVO },
  });
});

afterAll(async () => {
  await prisma.instructor.updateMany({
    where: { id: { in: desactivadosTemporalmente.instructores } },
    data: { activo: true },
  });
  await prisma.vehiculo.updateMany({
    where: { id: { in: desactivadosTemporalmente.vehiculos } },
    data: { estado: EstadoVehiculo.ACTIVO },
  });

  await prisma.reserva.deleteMany({ where: { clienteId: ID.cliente } });
  await prisma.excepcionDisponibilidad.deleteMany({
    where: { instructorId: { in: [ID.instructor, ID.instructorSoloMoto] } },
  });
  await prisma.disponibilidadPlantilla.deleteMany({
    where: { instructorId: { in: [ID.instructor, ID.instructorSoloMoto] } },
  });
  await prisma.vehiculo.deleteMany({ where: { id: { in: [ID.auto, ID.moto] } } });
  await prisma.cliente.deleteMany({ where: { id: ID.cliente } });
  await prisma.instructor.deleteMany({
    where: { id: { in: [ID.instructor, ID.instructorSoloMoto] } },
  });
  await prisma.usuario.deleteMany({ where: { id: ID.usuario } });
  await prisma.$disconnect();
});

describe('Huecos a partir de la plantilla semanal', () => {
  it('parte la franja en clases consecutivas separadas por el buffer', async () => {
    const huecos = await servicio.calcular(
      { tipo: TipoVehiculo.AUTO, ...rangoDelLunes(), duracionMin: DURACION },
      AHORA,
    );

    // 9 a 13 con clases de 45' y buffer de 15' da un paso de una hora exacta.
    expect(horasLocales(huecos)).toEqual(['09:00', '10:00', '11:00', '12:00']);
  });

  it('interpreta la plantilla en hora de Montevideo, no en UTC', async () => {
    const huecos = await servicio.calcular(
      { tipo: TipoVehiculo.AUTO, ...rangoDelLunes(), duracionMin: DURACION },
      AHORA,
    );

    // Uruguay está en UTC-3: las 9 locales son las 12 UTC. Si el motor ignorara
    // la zona, el primer hueco saldría a las 09:00 UTC (6 de la mañana local).
    expect(DateTime.fromJSDate(huecos[0]!.inicio).toUTC().toFormat('HH:mm')).toBe('12:00');
  });

  it('no ofrece nada un día sin plantilla', async () => {
    const martes = LUNES.plus({ days: 1 });
    const huecos = await servicio.calcular(
      {
        tipo: TipoVehiculo.AUTO,
        desde: martes.toJSDate(),
        hasta: martes.endOf('day').toJSDate(),
        duracionMin: DURACION,
      },
      AHORA,
    );
    expect(huecos).toHaveLength(0);
  });
});

describe('Las reservas existentes liberan y ocupan', () => {
  it('quita el horario ya reservado y el que su buffer invade', async () => {
    await prisma.reserva.create({
      data: {
        clienteId: ID.cliente,
        instructorId: ID.instructor,
        vehiculoId: ID.auto,
        tipo: TipoVehiculo.AUTO,
        inicio: LUNES.set({ hour: 10 }).toJSDate(),
        fin: LUNES.set({ hour: 10, minute: 45 }).toJSDate(),
        estado: EstadoReserva.CONFIRMADA,
      },
    });

    const huecos = await servicio.calcular(
      { tipo: TipoVehiculo.AUTO, ...rangoDelLunes(), duracionMin: DURACION },
      AHORA,
    );
    expect(horasLocales(huecos)).toEqual(['09:00', '11:00', '12:00']);
  });

  it('una reserva cancelada devuelve el horario a la oferta', async () => {
    const reserva = await prisma.reserva.create({
      data: {
        clienteId: ID.cliente,
        instructorId: ID.instructor,
        vehiculoId: ID.auto,
        tipo: TipoVehiculo.AUTO,
        inicio: LUNES.set({ hour: 10 }).toJSDate(),
        fin: LUNES.set({ hour: 10, minute: 45 }).toJSDate(),
        estado: EstadoReserva.CONFIRMADA,
      },
    });
    await prisma.reserva.update({
      where: { id: reserva.id },
      data: { estado: EstadoReserva.CANCELADA },
    });

    const huecos = await servicio.calcular(
      { tipo: TipoVehiculo.AUTO, ...rangoDelLunes(), duracionMin: DURACION },
      AHORA,
    );
    expect(horasLocales(huecos)).toContain('10:00');
  });
});

describe('Excepciones de disponibilidad', () => {
  it('un bloqueo parte la franja en dos', async () => {
    await prisma.excepcionDisponibilidad.create({
      data: {
        instructorId: ID.instructor,
        tipo: TipoExcepcion.BLOQUEO,
        inicio: LUNES.set({ hour: 10 }).toJSDate(),
        fin: LUNES.set({ hour: 12 }).toJSDate(),
        motivo: 'Trámite personal',
      },
    });

    const huecos = await servicio.calcular(
      { tipo: TipoVehiculo.AUTO, ...rangoDelLunes(), duracionMin: DURACION },
      AHORA,
    );
    // Queda 9-10 (entra una clase) y 12-13 (entra otra).
    expect(horasLocales(huecos)).toEqual(['09:00', '12:00']);
  });

  it('una disponibilidad extra agrega horarios fuera de la plantilla', async () => {
    await prisma.excepcionDisponibilidad.create({
      data: {
        instructorId: ID.instructor,
        tipo: TipoExcepcion.DISPONIBILIDAD_EXTRA,
        inicio: LUNES.set({ hour: 18 }).toJSDate(),
        fin: LUNES.set({ hour: 19 }).toJSDate(),
      },
    });

    const huecos = await servicio.calcular(
      { tipo: TipoVehiculo.AUTO, ...rangoDelLunes(), duracionMin: DURACION },
      AHORA,
    );
    expect(horasLocales(huecos)).toContain('18:00');
  });
});

describe('El vehículo es un recurso más, no un detalle', () => {
  it('no ofrece horarios si no hay vehículo del tipo pedido', async () => {
    await prisma.vehiculo.update({
      where: { id: ID.auto },
      data: { estado: EstadoVehiculo.MANTENIMIENTO },
    });

    const huecos = await servicio.calcular(
      { tipo: TipoVehiculo.AUTO, ...rangoDelLunes(), duracionMin: DURACION },
      AHORA,
    );
    expect(huecos).toHaveLength(0);
  });

  it('no ofrece un vehículo que otro instructor ya tiene tomado', async () => {
    await prisma.disponibilidadPlantilla.create({
      data: {
        instructorId: ID.instructorSoloMoto,
        diaSemana: 1,
        minutoInicio: 9 * 60,
        minutoFin: 13 * 60,
      },
    });
    // La única moto queda ocupada por el instructor de moto a las 9.
    await prisma.reserva.create({
      data: {
        clienteId: ID.cliente,
        instructorId: ID.instructorSoloMoto,
        vehiculoId: ID.moto,
        tipo: TipoVehiculo.MOTO,
        inicio: LUNES.set({ hour: 9 }).toJSDate(),
        fin: LUNES.set({ hour: 9, minute: 45 }).toJSDate(),
        estado: EstadoReserva.CONFIRMADA,
      },
    });

    // La instructora de moto y auto está libre a las 9, pero la moto no.
    const huecos = await servicio.calcular(
      {
        tipo: TipoVehiculo.MOTO,
        ...rangoDelLunes(),
        duracionMin: DURACION,
        instructorId: ID.instructor,
      },
      AHORA,
    );
    expect(horasLocales(huecos)).not.toContain('09:00');
    expect(horasLocales(huecos)).toContain('10:00');
  });

  it('ignora a los instructores no habilitados para el tipo de clase', async () => {
    await prisma.disponibilidadPlantilla.create({
      data: {
        instructorId: ID.instructorSoloMoto,
        diaSemana: 1,
        minutoInicio: 9 * 60,
        minutoFin: 13 * 60,
      },
    });

    const huecos = await servicio.calcular(
      {
        tipo: TipoVehiculo.AUTO,
        ...rangoDelLunes(),
        duracionMin: DURACION,
        instructorId: ID.instructorSoloMoto,
      },
      AHORA,
    );
    expect(huecos).toHaveLength(0);
  });
});

describe('Políticas de la academia', () => {
  it('descarta los horarios que no respetan la antelación mínima', async () => {
    // "Ahora" pasa a ser el propio lunes a las 8: con 12 horas de antelación
    // mínima, ese día ya no se puede reservar nada.
    const huecos = await servicio.calcular(
      { tipo: TipoVehiculo.AUTO, ...rangoDelLunes(), duracionMin: DURACION },
      LUNES.set({ hour: 8 }).toJSDate(),
    );
    expect(huecos).toHaveLength(0);
  });

  it('no ofrece horarios más allá de la ventana de reserva', async () => {
    const muyLejos = LUNES.plus({ days: 90 });
    const huecos = await servicio.calcular(
      {
        tipo: TipoVehiculo.AUTO,
        desde: muyLejos.toJSDate(),
        hasta: muyLejos.endOf('day').toJSDate(),
        duracionMin: DURACION,
      },
      AHORA,
    );
    expect(huecos).toHaveLength(0);
  });

  it('rechaza un rango invertido', async () => {
    await expect(
      servicio.calcular(
        {
          tipo: TipoVehiculo.AUTO,
          desde: LUNES.endOf('day').toJSDate(),
          hasta: LUNES.toJSDate(),
          duracionMin: DURACION,
        },
        AHORA,
      ),
    ).rejects.toThrow(/posterior al inicio/);
  });
});
