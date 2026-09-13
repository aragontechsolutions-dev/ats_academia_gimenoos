/**
 * Prueba de integracion de las constraints anti-doble-reserva.
 *
 * Esta es la invariante mas importante del sistema: dos alumnos no pueden
 * ocupar el mismo instructor, el mismo vehiculo ni el mismo horario. La
 * proteccion vive en Postgres (EXCLUDE constraints con btree_gist), asi que
 * la prueba corre contra una base real; no tiene sentido simularla.
 *
 * Requiere DATABASE_URL apuntando a un Postgres con las migraciones aplicadas.
 * En CI lo provee el servicio de Postgres del workflow.
 */
import { PrismaClient, EstadoReserva, TipoVehiculo } from '@prisma/client';

const prisma = new PrismaClient();

// Ids fijos para poder limpiar sin ambiguedad al terminar.
const ID_USUARIO = '00000000-0000-4000-9000-000000000001';
const ID_CLIENTE = '00000000-0000-4000-9000-000000000002';
const ID_CLIENTE_2 = '00000000-0000-4000-9000-000000000003';
const ID_USUARIO_2 = '00000000-0000-4000-9000-000000000004';
const ID_INSTRUCTOR_A = '00000000-0000-4000-9000-00000000000a';
const ID_INSTRUCTOR_B = '00000000-0000-4000-9000-00000000000b';
const ID_VEHICULO_1 = '00000000-0000-4000-9000-0000000000f1';
const ID_VEHICULO_2 = '00000000-0000-4000-9000-0000000000f2';

/** Fecha base lejana en el futuro para no chocar con datos de desarrollo. */
const hora = (h: number, m = 0) => new Date(Date.UTC(2030, 0, 15, h, m, 0));

interface DatosReserva {
  clienteId?: string;
  instructorId?: string;
  vehiculoId?: string | null;
  inicio: Date;
  fin: Date;
  estado?: EstadoReserva;
}

async function crearReserva(datos: DatosReserva) {
  return prisma.reserva.create({
    data: {
      clienteId: datos.clienteId ?? ID_CLIENTE,
      instructorId: datos.instructorId ?? ID_INSTRUCTOR_A,
      vehiculoId: datos.vehiculoId === undefined ? ID_VEHICULO_1 : datos.vehiculoId,
      tipo: TipoVehiculo.AUTO,
      inicio: datos.inicio,
      fin: datos.fin,
      estado: datos.estado ?? EstadoReserva.CONFIRMADA,
    },
  });
}

async function limpiarReservas(): Promise<void> {
  await prisma.reserva.deleteMany({
    where: { clienteId: { in: [ID_CLIENTE, ID_CLIENTE_2] } },
  });
}

beforeAll(async () => {
  await prisma.$connect();

  await prisma.usuario.upsert({
    where: { id: ID_USUARIO },
    update: {},
    create: { id: ID_USUARIO, email: 'prueba-agenda@local', nombre: 'Prueba', apellido: 'Agenda' },
  });
  await prisma.usuario.upsert({
    where: { id: ID_USUARIO_2 },
    update: {},
    create: { id: ID_USUARIO_2, email: 'prueba-agenda2@local', nombre: 'Prueba', apellido: 'Dos' },
  });
  await prisma.cliente.upsert({
    where: { id: ID_CLIENTE },
    update: {},
    create: { id: ID_CLIENTE, usuarioId: ID_USUARIO, nombre: 'Prueba', apellido: 'Uno' },
  });
  await prisma.cliente.upsert({
    where: { id: ID_CLIENTE_2 },
    update: {},
    create: { id: ID_CLIENTE_2, usuarioId: ID_USUARIO_2, nombre: 'Prueba', apellido: 'Dos' },
  });

  await prisma.instructor.upsert({
    where: { id: ID_INSTRUCTOR_A },
    update: {},
    create: { id: ID_INSTRUCTOR_A, nombre: 'Instructor', apellido: 'A' },
  });
  await prisma.instructor.upsert({
    where: { id: ID_INSTRUCTOR_B },
    update: {},
    create: { id: ID_INSTRUCTOR_B, nombre: 'Instructor', apellido: 'B' },
  });

  await prisma.vehiculo.upsert({
    where: { id: ID_VEHICULO_1 },
    update: {},
    create: { id: ID_VEHICULO_1, patente: 'TEST001', tipo: TipoVehiculo.AUTO },
  });
  await prisma.vehiculo.upsert({
    where: { id: ID_VEHICULO_2 },
    update: {},
    create: { id: ID_VEHICULO_2, patente: 'TEST002', tipo: TipoVehiculo.AUTO },
  });
});

beforeEach(limpiarReservas);

afterAll(async () => {
  await limpiarReservas();
  await prisma.instructor.deleteMany({ where: { id: { in: [ID_INSTRUCTOR_A, ID_INSTRUCTOR_B] } } });
  await prisma.vehiculo.deleteMany({ where: { id: { in: [ID_VEHICULO_1, ID_VEHICULO_2] } } });
  await prisma.cliente.deleteMany({ where: { id: { in: [ID_CLIENTE, ID_CLIENTE_2] } } });
  await prisma.usuario.deleteMany({ where: { id: { in: [ID_USUARIO, ID_USUARIO_2] } } });
  await prisma.$disconnect();
});

describe('La extension btree_gist esta instalada', () => {
  it('sin ella las constraints de agenda no existirian', async () => {
    const filas = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'btree_gist'
    `;
    expect(filas).toHaveLength(1);
  });
});

describe('Las constraints de agenda estan activas', () => {
  it('las tres constraints anti-doble-reserva existen en la base', async () => {
    const filas = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint
      WHERE conname IN (
        'reservas_sin_solape_instructor',
        'reservas_sin_solape_vehiculo',
        'reservas_sin_solape_cliente'
      )
      ORDER BY conname
    `;
    expect(filas.map((f) => f.conname)).toEqual([
      'reservas_sin_solape_cliente',
      'reservas_sin_solape_instructor',
      'reservas_sin_solape_vehiculo',
    ]);
  });
});

describe('Un instructor no puede dar dos clases a la vez', () => {
  it('rechaza una clase que se solapa con otra del mismo instructor', async () => {
    await crearReserva({ inicio: hora(10), fin: hora(10, 45) });

    await expect(
      crearReserva({
        inicio: hora(10, 30),
        fin: hora(11, 15),
        vehiculoId: ID_VEHICULO_2,
        clienteId: ID_CLIENTE_2,
      }),
    ).rejects.toThrow(/reservas_sin_solape_instructor/);
  });

  it('permite clases consecutivas: el rango es [inicio, fin)', async () => {
    await crearReserva({ inicio: hora(10), fin: hora(10, 45) });

    // Empieza exactamente cuando termina la anterior. Debe entrar.
    const consecutiva = await crearReserva({ inicio: hora(10, 45), fin: hora(11, 30) });
    expect(consecutiva.id).toBeDefined();
  });
});

describe('Un vehiculo no puede estar en dos clases a la vez', () => {
  it('rechaza el mismo vehiculo con otro instructor en horario solapado', async () => {
    await crearReserva({ inicio: hora(10), fin: hora(10, 45) });

    await expect(
      crearReserva({
        inicio: hora(10, 15),
        fin: hora(11),
        instructorId: ID_INSTRUCTOR_B,
        clienteId: ID_CLIENTE_2,
      }),
    ).rejects.toThrow(/reservas_sin_solape_vehiculo/);
  });

  it('no restringe las reservas sin vehiculo asignado', async () => {
    await crearReserva({ inicio: hora(14), fin: hora(14, 45), vehiculoId: null });

    // Dos reservas sin vehiculo y con distinto instructor y cliente no chocan:
    // en GiST, NULL no es igual a NULL.
    const otra = await crearReserva({
      inicio: hora(14),
      fin: hora(14, 45),
      vehiculoId: null,
      instructorId: ID_INSTRUCTOR_B,
      clienteId: ID_CLIENTE_2,
    });
    expect(otra.id).toBeDefined();
  });
});

describe('Un alumno no puede tener dos clases superpuestas', () => {
  it('rechaza el solapamiento aunque cambien instructor y vehiculo', async () => {
    await crearReserva({ inicio: hora(10), fin: hora(10, 45) });

    await expect(
      crearReserva({
        inicio: hora(10, 20),
        fin: hora(11),
        instructorId: ID_INSTRUCTOR_B,
        vehiculoId: ID_VEHICULO_2,
      }),
    ).rejects.toThrow(/reservas_sin_solape_cliente/);
  });
});

describe('Cancelar libera el horario', () => {
  it('permite reusar el horario de una reserva cancelada', async () => {
    const original = await crearReserva({ inicio: hora(10), fin: hora(10, 45) });

    await prisma.reserva.update({
      where: { id: original.id },
      data: { estado: EstadoReserva.CANCELADA, canceladaAt: new Date() },
    });

    const nueva = await crearReserva({ inicio: hora(10), fin: hora(10, 45) });
    expect(nueva.id).toBeDefined();
  });

  it('una reserva COMPLETADA tampoco bloquea el horario', async () => {
    const original = await crearReserva({
      inicio: hora(16),
      fin: hora(16, 45),
      estado: EstadoReserva.COMPLETADA,
    });
    expect(original.id).toBeDefined();

    const nueva = await crearReserva({ inicio: hora(16), fin: hora(16, 45) });
    expect(nueva.id).toBeDefined();
  });
});

describe('Integridad del intervalo', () => {
  it('rechaza una reserva que termina antes de empezar', async () => {
    await expect(crearReserva({ inicio: hora(12), fin: hora(11) })).rejects.toThrow(
      /reservas_intervalo_valido/,
    );
  });

  it('rechaza una reserva de duracion cero', async () => {
    await expect(crearReserva({ inicio: hora(12), fin: hora(12) })).rejects.toThrow(
      /reservas_intervalo_valido/,
    );
  });
});
