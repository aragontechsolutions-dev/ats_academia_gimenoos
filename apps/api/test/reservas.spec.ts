/**
 * Pruebas del servicio de reservas.
 *
 * El foco está en las reglas que, si fallan, causan dano real: que un alumno no
 * pueda tocar la clase de otro, que dos personas no tomen el mismo horario, y
 * que un pack no se pueda gastar desde otra cuenta.
 */
import { EstadoReserva, RolUsuario, TipoServicio, TipoVehiculo } from '@prisma/client';
import { DateTime } from 'luxon';

import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditoriaService } from '../src/common/auditoria/auditoria.service';
import { ReservasService } from '../src/modules/agenda/reservas.service';
import type { UsuarioAutenticado } from '../src/common/auth/jwt-payload.interface';

const prisma = new PrismaService();
const servicio = new ReservasService(prisma, new AuditoriaService(prisma));

const ID = {
  usuarioAdmin: '00000000-0000-4000-c000-000000000001',
  usuarioAna: '00000000-0000-4000-c000-000000000002',
  usuarioBruno: '00000000-0000-4000-c000-000000000003',
  usuarioInstructor: '00000000-0000-4000-c000-000000000004',
  clienteAna: '00000000-0000-4000-c000-00000000000a',
  clienteBruno: '00000000-0000-4000-c000-00000000000b',
  instructor: '00000000-0000-4000-c000-0000000000e1',
  instructorAjeno: '00000000-0000-4000-c000-0000000000e2',
  auto: '00000000-0000-4000-c000-0000000000f1',
  auto2: '00000000-0000-4000-c000-0000000000f2',
  moto: '00000000-0000-4000-c000-0000000000f3',
  servicio: '00000000-0000-4000-c000-0000000000d1',
};

const ADMIN: UsuarioAutenticado = { id: ID.usuarioAdmin, email: 'admin@local', rol: RolUsuario.ADMIN };
const ANA: UsuarioAutenticado = { id: ID.usuarioAna, email: 'ana@local', rol: RolUsuario.CLIENTE };
const BRUNO: UsuarioAutenticado = { id: ID.usuarioBruno, email: 'bruno@local', rol: RolUsuario.CLIENTE };
const INSTRUCTOR: UsuarioAutenticado = {
  id: ID.usuarioInstructor,
  email: 'instructor@local',
  rol: RolUsuario.INSTRUCTOR,
};

const AHORA = DateTime.fromObject({ year: 2030, month: 3, day: 1, hour: 9 }, { zone: 'utc' });
/** Bien dentro de la ventana permitida: 5 días adelante. */
const enCincoDias = (hora: number, minuto = 0) =>
  AHORA.plus({ days: 5 }).set({ hour: hora, minute: minuto, second: 0, millisecond: 0 }).toJSDate();

const baseReserva = {
  instructorId: ID.instructor,
  vehiculoId: ID.auto,
  tipo: TipoVehiculo.AUTO,
  duracionMin: 45,
};

beforeAll(async () => {
  await prisma.$connect();
  await prisma.configuracionAcademia.upsert({
    where: { id: 1 },
    update: { antelacionMinimaHoras: 12, cancelacionMinimaHoras: 24 },
    create: { id: 1, antelacionMinimaHoras: 12, cancelacionMinimaHoras: 24 },
  });

  const usuarios = [
    { id: ID.usuarioAdmin, email: 'admin-res@local', nombre: 'Admin', apellido: 'Test' },
    { id: ID.usuarioAna, email: 'ana-res@local', nombre: 'Ana', apellido: 'Alumna' },
    { id: ID.usuarioBruno, email: 'bruno-res@local', nombre: 'Bruno', apellido: 'Alumno' },
    { id: ID.usuarioInstructor, email: 'inst-res@local', nombre: 'Ivan', apellido: 'Instructor' },
  ];
  for (const usuario of usuarios) {
    await prisma.usuario.upsert({ where: { id: usuario.id }, update: {}, create: usuario });
  }

  await prisma.cliente.upsert({
    where: { id: ID.clienteAna },
    update: {},
    create: { id: ID.clienteAna, usuarioId: ID.usuarioAna, nombre: 'Ana', apellido: 'Alumna' },
  });
  await prisma.cliente.upsert({
    where: { id: ID.clienteBruno },
    update: {},
    create: { id: ID.clienteBruno, usuarioId: ID.usuarioBruno, nombre: 'Bruno', apellido: 'Alumno' },
  });

  await prisma.instructor.upsert({
    where: { id: ID.instructor },
    update: { activo: true, habilitaAuto: true, habilitaMoto: false, usuarioId: ID.usuarioInstructor },
    create: {
      id: ID.instructor,
      nombre: 'Ivan',
      apellido: 'Instructor',
      habilitaAuto: true,
      habilitaMoto: false,
      usuarioId: ID.usuarioInstructor,
    },
  });
  await prisma.instructor.upsert({
    where: { id: ID.instructorAjeno },
    update: { activo: true, habilitaAuto: true },
    create: { id: ID.instructorAjeno, nombre: 'Otro', apellido: 'Instructor', habilitaAuto: true },
  });

  await prisma.vehiculo.upsert({
    where: { id: ID.auto },
    update: {},
    create: { id: ID.auto, patente: 'RESA01', tipo: TipoVehiculo.AUTO },
  });
  await prisma.vehiculo.upsert({
    where: { id: ID.auto2 },
    update: {},
    create: { id: ID.auto2, patente: 'RESA02', tipo: TipoVehiculo.AUTO },
  });
  await prisma.vehiculo.upsert({
    where: { id: ID.moto },
    update: {},
    create: { id: ID.moto, patente: 'RESM01', tipo: TipoVehiculo.MOTO },
  });

  await prisma.servicio.upsert({
    where: { id: ID.servicio },
    update: {},
    create: {
      id: ID.servicio,
      slug: 'pack-pruebas-reservas',
      nombre: 'Pack de pruebas',
      tipo: TipoServicio.PACK,
      tipoVehiculo: TipoVehiculo.AUTO,
      cantidadClases: 2,
      duracionMin: 45,
      precioContado: 0,
      precioTarjeta: 0,
      publico: false,
    },
  });
});

beforeEach(async () => {
  await prisma.reserva.deleteMany({
    where: { clienteId: { in: [ID.clienteAna, ID.clienteBruno] } },
  });
  await prisma.compraServicio.deleteMany({
    where: { clienteId: { in: [ID.clienteAna, ID.clienteBruno] } },
  });
});

afterAll(async () => {
  await prisma.reserva.deleteMany({
    where: { clienteId: { in: [ID.clienteAna, ID.clienteBruno] } },
  });
  await prisma.compraServicio.deleteMany({
    where: { clienteId: { in: [ID.clienteAna, ID.clienteBruno] } },
  });
  await prisma.servicio.deleteMany({ where: { id: ID.servicio } });
  await prisma.vehiculo.deleteMany({ where: { id: { in: [ID.auto, ID.auto2, ID.moto] } } });
  await prisma.cliente.deleteMany({ where: { id: { in: [ID.clienteAna, ID.clienteBruno] } } });
  await prisma.instructor.deleteMany({ where: { id: { in: [ID.instructor, ID.instructorAjeno] } } });
  await prisma.usuario.deleteMany({
    where: { id: { in: [ID.usuarioAdmin, ID.usuarioAna, ID.usuarioBruno, ID.usuarioInstructor] } },
  });
  await prisma.$disconnect();
});

describe('Un alumno solo puede operar sobre sus propias clases', () => {
  it('al agendar, se ignora el alumno que venga en el cuerpo del request', async () => {
    // Ana envía el id de Bruno: si el servicio lo respetara, cualquiera podría
    // llenarle la agenda a otro alumno.
    const reserva = await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteBruno, inicio: enCincoDias(10) },
      ANA,
      AHORA.toJSDate(),
    );
    expect(reserva.cliente.id).toBe(ID.clienteAna);
  });

  it('no puede ver la clase de otro alumno', async () => {
    const deBruno = await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteBruno, inicio: enCincoDias(10) },
      ADMIN,
      AHORA.toJSDate(),
    );

    await expect(servicio.obtener(deBruno.id, ANA)).rejects.toThrow(/no es tuya/);
  });

  it('no puede cancelar la clase de otro alumno', async () => {
    const deBruno = await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteBruno, inicio: enCincoDias(10) },
      ADMIN,
      AHORA.toJSDate(),
    );

    await expect(servicio.cancelar(deBruno.id, 'no quiero', ANA, AHORA.toJSDate())).rejects.toThrow(
      /no es tuya/,
    );
  });

  it('al listar, solo recibe las suyas aunque pida las de otro', async () => {
    await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteAna, inicio: enCincoDias(10) },
      ADMIN,
      AHORA.toJSDate(),
    );
    await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteBruno, inicio: enCincoDias(12) },
      ADMIN,
      AHORA.toJSDate(),
    );

    const listado = await servicio.listar(
      {
        desde: AHORA.toJSDate(),
        hasta: AHORA.plus({ days: 30 }).toJSDate(),
        clienteId: ID.clienteBruno,
      },
      ANA,
    );

    expect(listado).toHaveLength(1);
    expect(listado[0]!.cliente.id).toBe(ID.clienteAna);
  });
});

describe('Alcance del instructor y del administrador', () => {
  it('el instructor ve su agenda y no la de otro instructor', async () => {
    await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteAna, inicio: enCincoDias(10) },
      ADMIN,
      AHORA.toJSDate(),
    );
    await servicio.crear(
      {
        ...baseReserva,
        instructorId: ID.instructorAjeno,
        vehiculoId: ID.auto2,
        clienteId: ID.clienteBruno,
        inicio: enCincoDias(10),
      },
      ADMIN,
      AHORA.toJSDate(),
    );

    const listado = await servicio.listar(
      { desde: AHORA.toJSDate(), hasta: AHORA.plus({ days: 30 }).toJSDate() },
      INSTRUCTOR,
    );

    expect(listado).toHaveLength(1);
    expect(listado[0]!.instructor.id).toBe(ID.instructor);
  });

  it('el administrador ve todas', async () => {
    await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteAna, inicio: enCincoDias(10) },
      ADMIN,
      AHORA.toJSDate(),
    );
    await servicio.crear(
      { ...baseReserva, vehiculoId: ID.auto2, clienteId: ID.clienteBruno, inicio: enCincoDias(15) },
      ADMIN,
      AHORA.toJSDate(),
    );

    const listado = await servicio.listar(
      { desde: AHORA.toJSDate(), hasta: AHORA.plus({ days: 30 }).toJSDate() },
      ADMIN,
    );
    expect(listado).toHaveLength(2);
  });
});

describe('Dos personas no pueden tomar el mismo horario', () => {
  it('rechaza una segunda clase superpuesta para el mismo instructor', async () => {
    await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteAna, inicio: enCincoDias(10) },
      ADMIN,
      AHORA.toJSDate(),
    );

    await expect(
      servicio.crear(
        {
          ...baseReserva,
          vehiculoId: ID.auto2,
          clienteId: ID.clienteBruno,
          inicio: enCincoDias(10, 30),
        },
        ADMIN,
        AHORA.toJSDate(),
      ),
    ).rejects.toThrow(/reservas_sin_solape_instructor/);
  });

  it('ante dos pedidos simultáneos, solo uno queda agendado', async () => {
    // Es la carrera real: dos personas apretando "reservar" a la vez sobre el
    // mismo hueco. La garantía no está en el código sino en la constraint.
    const resultados = await Promise.allSettled([
      servicio.crear(
        { ...baseReserva, clienteId: ID.clienteAna, inicio: enCincoDias(16) },
        ADMIN,
        AHORA.toJSDate(),
      ),
      servicio.crear(
        { ...baseReserva, clienteId: ID.clienteBruno, inicio: enCincoDias(16) },
        ADMIN,
        AHORA.toJSDate(),
      ),
    ]);

    const exitosas = resultados.filter((r) => r.status === 'fulfilled');
    expect(exitosas).toHaveLength(1);

    const guardadas = await prisma.reserva.count({
      where: { inicio: enCincoDias(16), estado: { in: ['PENDIENTE', 'CONFIRMADA'] } },
    });
    expect(guardadas).toBe(1);
  });

  it('cancelar libera el horario para otro alumno', async () => {
    const deAna = await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteAna, inicio: enCincoDias(10) },
      ADMIN,
      AHORA.toJSDate(),
    );
    await servicio.cancelar(deAna.id, 'cambio de planes', ADMIN, AHORA.toJSDate());

    const deBruno = await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteBruno, inicio: enCincoDias(10) },
      ADMIN,
      AHORA.toJSDate(),
    );
    expect(deBruno.id).toBeDefined();
  });
});

describe('Políticas de antelación y cancelación', () => {
  it('el alumno no puede reservar con menos antelación que la mínima', async () => {
    await expect(
      servicio.crear(
        { ...baseReserva, inicio: AHORA.plus({ hours: 2 }).toJSDate() },
        ANA,
        AHORA.toJSDate(),
      ),
    ).rejects.toThrow(/12 horas de antelación/);
  });

  it('la academia sí puede agendar con poca antelación', async () => {
    const reserva = await servicio.crear(
      {
        ...baseReserva,
        clienteId: ID.clienteAna,
        inicio: AHORA.plus({ hours: 2 }).toJSDate(),
      },
      ADMIN,
      AHORA.toJSDate(),
    );
    expect(reserva.estado).toBe(EstadoReserva.CONFIRMADA);
  });

  it('el alumno no puede cancelar sobre la hora', async () => {
    const reserva = await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteAna, inicio: enCincoDias(10) },
      ADMIN,
      AHORA.toJSDate(),
    );

    // Faltan 3 horas para la clase: por debajo de las 24 exigidas.
    const casiLaHora = DateTime.fromJSDate(reserva.inicio).minus({ hours: 3 }).toJSDate();
    await expect(servicio.cancelar(reserva.id, undefined, ANA, casiLaHora)).rejects.toThrow(
      /24 horas de antelación/,
    );
  });

  it('la academia puede cancelar aunque falte poco: si el instructor falta, la clase no se da', async () => {
    const reserva = await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteAna, inicio: enCincoDias(10) },
      ADMIN,
      AHORA.toJSDate(),
    );

    const casiLaHora = DateTime.fromJSDate(reserva.inicio).minus({ hours: 1 }).toJSDate();
    const cancelada = await servicio.cancelar(reserva.id, 'instructor enfermo', ADMIN, casiLaHora);
    expect(cancelada.estado).toBe(EstadoReserva.CANCELADA);
  });
});

describe('Reprogramar', () => {
  it('mueve la clase conservando su identificador', async () => {
    const reserva = await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteAna, inicio: enCincoDias(10) },
      ADMIN,
      AHORA.toJSDate(),
    );

    const movida = await servicio.reprogramar(
      reserva.id,
      { inicio: enCincoDias(15), duracionMin: 45 },
      ADMIN,
      AHORA.toJSDate(),
    );

    expect(movida.id).toBe(reserva.id);
    expect(movida.inicio).toEqual(enCincoDias(15));
  });

  it('no permite mover una clase ya cancelada', async () => {
    const reserva = await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteAna, inicio: enCincoDias(10) },
      ADMIN,
      AHORA.toJSDate(),
    );
    await servicio.cancelar(reserva.id, undefined, ADMIN, AHORA.toJSDate());

    await expect(
      servicio.reprogramar(
        reserva.id,
        { inicio: enCincoDias(15), duracionMin: 45 },
        ADMIN,
        AHORA.toJSDate(),
      ),
    ).rejects.toThrow(/pendientes o confirmadas/);
  });
});

describe('Validación de recursos', () => {
  it('rechaza un instructor no habilitado para el tipo de clase', async () => {
    await expect(
      servicio.crear(
        {
          ...baseReserva,
          tipo: TipoVehiculo.MOTO,
          vehiculoId: ID.moto,
          clienteId: ID.clienteAna,
          inicio: enCincoDias(10),
        },
        ADMIN,
        AHORA.toJSDate(),
      ),
    ).rejects.toThrow(/no está habilitado/);
  });

  it('rechaza un vehículo que no corresponde al tipo de clase', async () => {
    await expect(
      servicio.crear(
        { ...baseReserva, vehiculoId: ID.moto, clienteId: ID.clienteAna, inicio: enCincoDias(10) },
        ADMIN,
        AHORA.toJSDate(),
      ),
    ).rejects.toThrow(/no corresponde al tipo/);
  });
});

describe('Packs de clases', () => {
  const crearPack = (clienteId: string) =>
    prisma.compraServicio.create({
      data: { clienteId, servicioId: ID.servicio, clasesTotales: 2, montoTotal: 0 },
    });

  it('completar una clase descuenta del pack', async () => {
    const pack = await crearPack(ID.clienteAna);
    const reserva = await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteAna, compraId: pack.id, inicio: enCincoDias(10) },
      ADMIN,
      AHORA.toJSDate(),
    );

    await servicio.cambiarEstado(reserva.id, EstadoReserva.COMPLETADA, ADMIN);

    const actualizado = await prisma.compraServicio.findUniqueOrThrow({ where: { id: pack.id } });
    expect(actualizado.clasesUsadas).toBe(1);
  });

  it('no se puede gastar el pack de otro alumno', async () => {
    const packDeBruno = await crearPack(ID.clienteBruno);

    await expect(
      servicio.crear(
        { ...baseReserva, compraId: packDeBruno.id, inicio: enCincoDias(10) },
        ANA,
        AHORA.toJSDate(),
      ),
    ).rejects.toThrow(/pertenece a otro alumno/);
  });

  it('rechaza usar un pack sin clases disponibles', async () => {
    const pack = await crearPack(ID.clienteAna);
    await prisma.compraServicio.update({ where: { id: pack.id }, data: { clasesUsadas: 2 } });

    await expect(
      servicio.crear(
        { ...baseReserva, compraId: pack.id, inicio: enCincoDias(10) },
        ANA,
        AHORA.toJSDate(),
      ),
    ).rejects.toThrow(/no tiene clases disponibles/);
  });
});
