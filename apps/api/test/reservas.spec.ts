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
import { AgendaController } from '../src/modules/agenda/agenda.controller';
import { ROLES_REQUERIDOS } from '../src/common/auth/roles.decorator';
import type { UsuarioAutenticado } from '../src/common/auth/jwt-payload.interface';
import { telegramCallado } from './ayuda/telegram-callado';

const prisma = new PrismaService();
const servicio = new ReservasService(prisma, new AuditoriaService(prisma), telegramCallado());

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

describe('El rango de la consulta está acotado', () => {
  // Sin tope, cualquier cuenta autenticada puede pedir la tabla entera en una
  // sola llamada. El límite no distingue rol a propósito: un administrador
  // tampoco necesita diez años de agenda de una vez.
  it('rechaza pedir diez años de agenda', async () => {
    await expect(
      servicio.listar(
        { desde: AHORA.toJSDate(), hasta: AHORA.plus({ years: 10 }).toJSDate() },
        INSTRUCTOR,
      ),
    ).rejects.toThrow(/no puede superar 62 días/);
  });

  it('lo rechaza también al administrador', async () => {
    await expect(
      servicio.listar(
        { desde: AHORA.toJSDate(), hasta: AHORA.plus({ days: 90 }).toJSDate() },
        ADMIN,
      ),
    ).rejects.toThrow(/no puede superar 62 días/);
  });

  // 42 es el peor caso real: la grilla de un mes con los días de relleno de la
  // semana anterior y la siguiente. Si esta prueba falla, la vista de mes de la
  // app del instructor deja de cargar.
  it('deja pasar la grilla completa de un mes', async () => {
    await expect(
      servicio.listar(
        { desde: AHORA.toJSDate(), hasta: AHORA.plus({ days: 42 }).toJSDate() },
        INSTRUCTOR,
      ),
    ).resolves.toBeDefined();
  });

  it('deja pasar el tope exacto', async () => {
    await expect(
      servicio.listar(
        { desde: AHORA.toJSDate(), hasta: AHORA.plus({ days: 62 }).toJSDate() },
        INSTRUCTOR,
      ),
    ).resolves.toBeDefined();
  });

  /**
   * Esta es la prueba que faltaba y que costó una regresión en producción: el
   * tope se puso igual para todos, y la pantalla de «Mis clases» del alumno
   * —que pide un año hacia atrás y tres meses hacia adelante— quedó mostrando
   * un error rojo en vez de sus clases.
   *
   * Si alguien cambia el rango que pide esa pantalla, tiene que cambiar esta
   * prueba, y ahí se va a encontrar con el tope antes de romper nada.
   */
  it('EL RANGO QUE PIDE LA APP DEL ALUMNO ENTRA: un año atrás y tres meses adelante', async () => {
    const desde = AHORA.minus({ years: 1 }).toJSDate();
    const hasta = AHORA.plus({ months: 3 }).toJSDate();

    await expect(servicio.listar({ desde, hasta }, ANA)).resolves.toBeDefined();
  });

  it('pero el alumno tampoco pide diez años', async () => {
    await expect(
      servicio.listar({ desde: AHORA.toJSDate(), hasta: AHORA.plus({ years: 10 }).toJSDate() }, ANA),
    ).rejects.toThrow(/no puede superar 730 días/);
  });

  it('el mismo rango del alumno NO se le permite al administrador', async () => {
    // Su consulta es la única que no está acotada a las reservas de una
    // persona, asi que es la que de verdad puede recorrer la tabla entera.
    await expect(
      servicio.listar(
        { desde: AHORA.minus({ years: 1 }).toJSDate(), hasta: AHORA.plus({ months: 3 }).toJSDate() },
        ADMIN,
      ),
    ).rejects.toThrow(/no puede superar 62 días/);
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

describe('El instructor cierra su clase', () => {
  // Es lo que hace desde su app: marcarla como dictada, o al alumno como ausente.

  const claseDe = (instructorId: string, hora: number) =>
    servicio.crear(
      { ...baseReserva, clienteId: ID.clienteAna, instructorId, inicio: enCincoDias(hora) },
      ADMIN,
      AHORA.toJSDate(),
    );

  it('puede cerrar una clase suya como dictada', async () => {
    const reserva = await claseDe(ID.instructor, 14);

    const cerrada = await servicio.cambiarEstado(
      reserva.id,
      EstadoReserva.COMPLETADA,
      INSTRUCTOR,
    );
    expect(cerrada.estado).toBe(EstadoReserva.COMPLETADA);
  });

  it('y marcar que el alumno faltó', async () => {
    const reserva = await claseDe(ID.instructor, 15);

    const cerrada = await servicio.cambiarEstado(reserva.id, EstadoReserva.AUSENTE, INSTRUCTOR);
    expect(cerrada.estado).toBe(EstadoReserva.AUSENTE);
  });

  it('NO puede cerrar la clase de otro instructor', async () => {
    // El id de la clase viaja en la dirección: cambiarlo es el ataque más obvio.
    const ajena = await claseDe(ID.instructorAjeno, 16);

    await expect(
      servicio.cambiarEstado(ajena.id, EstadoReserva.COMPLETADA, INSTRUCTOR),
    ).rejects.toThrow(/no es de tu agenda/i);
  });

  it('marcar ausente NO descuenta del pack del alumno', async () => {
    // Solo se consume una clase cuando de verdad se dio. Descontarla igual sería
    // cobrarle al alumno una clase que no tuvo.
    const pack = await prisma.compraServicio.create({
      data: { clienteId: ID.clienteAna, servicioId: ID.servicio, clasesTotales: 2, montoTotal: 0 },
    });
    const reserva = await servicio.crear(
      { ...baseReserva, clienteId: ID.clienteAna, compraId: pack.id, inicio: enCincoDias(17) },
      ADMIN,
      AHORA.toJSDate(),
    );

    await servicio.cambiarEstado(reserva.id, EstadoReserva.AUSENTE, INSTRUCTOR);

    const despues = await prisma.compraServicio.findUniqueOrThrow({ where: { id: pack.id } });
    expect(despues.clasesUsadas).toBe(0);
  });

  it('un alumno no llega a este endpoint: lo frena el rol', () => {
    /**
     * Esto se comprueba sobre el decorador y no llamando al servicio, y el
     * motivo importa: `verificarAcceso` deja pasar a un alumno sobre SU propia
     * clase. Lo único que impide que un alumno marque su clase como dictada
     * —y se descuente una del pack— es este `@Roles`. Si alguien lo sacara, el
     * servicio no lo frenaría.
     */
    const roles = Reflect.getMetadata(
      ROLES_REQUERIDOS,
      AgendaController.prototype.cambiarEstado,
    ) as RolUsuario[] | undefined;

    expect(roles).toEqual([RolUsuario.ADMIN, RolUsuario.INSTRUCTOR]);
    expect(roles).not.toContain(RolUsuario.CLIENTE);
  });
});

describe('El instructor cancela su clase', () => {
  // Es la tercera acción de su app, y la única que no es un cierre: la clase no
  // se dio ni el alumno faltó, directamente no va a pasar.

  const claseDe = (instructorId: string, hora: number) =>
    servicio.crear(
      { ...baseReserva, clienteId: ID.clienteAna, instructorId, inicio: enCincoDias(hora) },
      ADMIN,
      AHORA.toJSDate(),
    );

  const crearPack = (clienteId: string) =>
    prisma.compraServicio.create({
      data: { clienteId, servicioId: ID.servicio, clasesTotales: 2, montoTotal: 0 },
    });

  it('puede cancelar una clase suya, con motivo', async () => {
    const reserva = await claseDe(ID.instructor, 8);

    const cancelada = await servicio.cancelar(
      reserva.id,
      'El auto quedó en el taller',
      INSTRUCTOR,
      AHORA.toJSDate(),
    );

    expect(cancelada.estado).toBe(EstadoReserva.CANCELADA);
    expect(cancelada.motivoCancelacion).toBe('El auto quedó en el taller');
  });

  it('NO puede cancelar la clase de otro instructor', async () => {
    // El id viaja en la dirección: cambiarlo es el ataque más obvio, y cancelar
    // la clase ajena le dejaría el horario libre a costa de otro.
    const ajena = await claseDe(ID.instructorAjeno, 9);

    await expect(
      servicio.cancelar(ajena.id, 'no es mía', INSTRUCTOR, AHORA.toJSDate()),
    ).rejects.toThrow(/no es de tu agenda/);
  });

  it('cancelar NO descuenta la clase del pack del alumno', async () => {
    // Es la diferencia de fondo con marcarla dictada, y por eso son dos botones
    // distintos en la app: si cancelar gastara la clase, el alumno pagaría una
    // clase que no se dio.
    const pack = await crearPack(ID.clienteAna);
    const reserva = await servicio.crear(
      { ...baseReserva, compraId: pack.id, inicio: enCincoDias(11) },
      ANA,
      AHORA.toJSDate(),
    );

    await servicio.cancelar(reserva.id, 'llovía', ADMIN, AHORA.toJSDate());

    const actualizado = await prisma.compraServicio.findUniqueOrThrow({ where: { id: pack.id } });
    expect(actualizado.clasesUsadas).toBe(0);
  });

  it('el instructor puede cancelar sobre la hora: la antelación rige para el alumno', async () => {
    // Si el instructor se enferma o el auto no arranca, la clase no se da igual.
    // Obligarlo a respetar la antelación mínima lo dejaría sin forma de avisar.
    const reserva = await claseDe(ID.instructor, 12);
    const casiLaHora = DateTime.fromJSDate(reserva.inicio).minus({ hours: 1 }).toJSDate();

    const cancelada = await servicio.cancelar(
      reserva.id,
      'instructor enfermo',
      INSTRUCTOR,
      casiLaHora,
    );
    expect(cancelada.estado).toBe(EstadoReserva.CANCELADA);
  });
});

describe('La observación de la clase', () => {
  // La escribe el instructor que la dio. El alumno NO la recibe: son
  // observaciones de desempeño para la academia, no un mensaje para él.

  const claseDeAna = (hora: number, instructorId = ID.instructor) =>
    servicio.crear(
      { ...baseReserva, clienteId: ID.clienteAna, instructorId, inicio: enCincoDias(hora) },
      ADMIN,
      AHORA.toJSDate(),
    );

  it('el instructor la escribe sobre su propia clase', async () => {
    const reserva = await claseDeAna(8);

    const guardada = await servicio.guardarNota(reserva.id, '  Le cuesta el estacionamiento  ', INSTRUCTOR);

    expect(guardada).toMatchObject({ notaInstructor: 'Le cuesta el estacionamiento' });
  });

  it('EL ALUMNO NO LA RECIBE, ni en el listado ni en el detalle', async () => {
    // Esta es la prueba que importa. Que la pantalla del alumno no la dibuje no
    // alcanzaría: el dato no tiene que salir de la base para él.
    const reserva = await claseDeAna(9);
    await servicio.guardarNota(reserva.id, 'Todavía no mira los espejos', INSTRUCTOR);

    const detalle = await servicio.obtener(reserva.id, ANA);
    expect(detalle).not.toHaveProperty('notaInstructor');

    const listado = await servicio.listar(
      { desde: enCincoDias(0), hasta: enCincoDias(23, 59) },
      ANA,
    );
    expect(listado.length).toBeGreaterThan(0);
    for (const fila of listado) expect(fila).not.toHaveProperty('notaInstructor');

    // Y para que la prueba valga: el instructor SÍ la recibe.
    const suyo = await servicio.obtener(reserva.id, INSTRUCTOR);
    expect(suyo).toMatchObject({ notaInstructor: 'Todavía no mira los espejos' });
  });

  it('un instructor NO puede anotar sobre la clase de otro', async () => {
    const ajena = await claseDeAna(10, ID.instructorAjeno);

    await expect(servicio.guardarNota(ajena.id, 'no es mía', INSTRUCTOR)).rejects.toThrow(
      /no es de tu agenda/i,
    );
  });

  it('la cadena vacía borra la observación', async () => {
    const reserva = await claseDeAna(11);
    await servicio.guardarNota(reserva.id, 'algo', INSTRUCTOR);

    const borrada = await servicio.guardarNota(reserva.id, '   ', INSTRUCTOR);
    expect(borrada).toMatchObject({ notaInstructor: null });
  });

  it('la auditoría deja rastro de quién anotó, pero NO copia el texto', async () => {
    // Es una observación sobre una persona: la auditoría responde "quién y
    // cuándo", no guarda una segunda copia del dato en otra tabla.
    const reserva = await claseDeAna(12);
    await servicio.guardarNota(reserva.id, 'Un texto muy particular y reconocible', INSTRUCTOR);

    const registro = await prisma.registroAuditoria.findFirst({
      where: { accion: 'RESERVA_NOTA_GUARDADA', entidadId: reserva.id },
    });
    expect(registro).not.toBeNull();
    expect(JSON.stringify(registro)).not.toContain('reconocible');
  });

  it('un alumno no llega a este endpoint: lo frena el rol', () => {
    // Igual que con el cierre de la clase: `verificarAcceso` dejaría pasar a un
    // alumno sobre SU propia clase, así que el `@Roles` es lo único que impide
    // que se escriba su propia observación.
    const roles = Reflect.getMetadata(
      ROLES_REQUERIDOS,
      AgendaController.prototype.guardarNota,
    ) as RolUsuario[] | undefined;

    expect(roles).toEqual([RolUsuario.ADMIN, RolUsuario.INSTRUCTOR]);
    expect(roles).not.toContain(RolUsuario.CLIENTE);
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
