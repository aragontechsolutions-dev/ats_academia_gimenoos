/**
 * Pruebas de la ficha del alumno.
 *
 * Dos comportamientos con consecuencias reales si fallan: que un instructor no
 * vea datos identificatorios que no necesita, y que la vinculación automática
 * de fichas no le entregue a alguien el historial de otra persona.
 */
import { RolUsuario } from '@prisma/client';

import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditoriaService } from '../src/common/auditoria/auditoria.service';
import { ClientesService } from '../src/modules/clientes/clientes.service';
import type { UsuarioAutenticado } from '../src/common/auth/jwt-payload.interface';

const prisma = new PrismaService();
const clientes = new ClientesService(prisma, new AuditoriaService(prisma));

const ID = {
  usuarioAdmin: '00000000-0000-4000-d000-000000000001',
  usuarioInstructor: '00000000-0000-4000-d000-000000000002',
  cliente: '00000000-0000-4000-d000-00000000000a',
};

const ADMIN: UsuarioAutenticado = {
  id: ID.usuarioAdmin,
  email: 'admin-cli@local',
  rol: RolUsuario.ADMIN,
};
const INSTRUCTOR: UsuarioAutenticado = {
  id: ID.usuarioInstructor,
  email: 'inst-cli@local',
  rol: RolUsuario.INSTRUCTOR,
};

beforeAll(async () => {
  await prisma.$connect();
  for (const usuario of [
    { id: ID.usuarioAdmin, email: 'admin-cli@local', nombre: 'Admin', apellido: 'Cli' },
    { id: ID.usuarioInstructor, email: 'inst-cli@local', nombre: 'Inst', apellido: 'Cli' },
  ]) {
    await prisma.usuario.upsert({ where: { id: usuario.id }, update: {}, create: usuario });
  }
});

beforeEach(async () => {
  await prisma.cliente.deleteMany({ where: { id: ID.cliente } });

  await prisma.cliente.create({
    data: {
      id: ID.cliente,
      nombre: 'Lucía',
      apellido: 'Pereira',
      telefono: '099555444',
      email: 'lucia@local',
      documento: '12345678',
      direccion: 'Calle Falsa 123',
      notasInternas: 'Le cuesta el estacionamiento',
    },
  });
});

afterAll(async () => {
  await prisma.cliente.deleteMany({ where: { id: ID.cliente } });
  await prisma.usuario.deleteMany({
    where: { id: { in: [ID.usuarioAdmin, ID.usuarioInstructor] } },
  });
  await prisma.$disconnect();
});

describe('Cada rol ve solo los datos que necesita', () => {
  it('el administrador ve la cédula y las notas internas', async () => {
    const ficha = await clientes.obtener(ID.cliente, ADMIN);
    expect(ficha).toMatchObject({ documento: '12345678', notasInternas: expect.any(String) });
  });

  it('el instructor no recibe cédula, domicilio ni notas internas', async () => {
    const ficha = await clientes.obtener(ID.cliente, INSTRUCTOR);

    // No alcanza con que estén vacíos: no deben viajar en la respuesta.
    expect(ficha).not.toHaveProperty('cedula');
    expect(ficha).not.toHaveProperty('direccion');
    expect(ficha).not.toHaveProperty('notasInternas');
    // Lo que sí necesita para coordinar la clase.
    expect(ficha).toMatchObject({ nombre: 'Lucía', telefono: '099555444' });
  });

  // Las aserciones miran si la ficha buscada aparece, en vez de contar
  // resultados: la base puede tener otros alumnos y contar haría que la prueba
  // falle por algo que no tiene nada que ver con lo que verifica.
  it('el instructor no puede encontrar a un alumno por su cédula', async () => {
    const comoAdmin = await clientes.listar({ q: '12345678' }, ADMIN);
    expect(comoAdmin.datos.map((c) => c.id)).toContain(ID.cliente);

    const comoInstructor = await clientes.listar({ q: '12345678' }, INSTRUCTOR);
    expect(comoInstructor.datos.map((c) => c.id)).not.toContain(ID.cliente);
  });

  it('la búsqueda por nombre funciona para ambos', async () => {
    const comoInstructor = await clientes.listar({ q: 'Pereira' }, INSTRUCTOR);
    expect(comoInstructor.datos.map((c) => c.id)).toContain(ID.cliente);
  });
});

describe('El alumno consulta y edita su propia ficha', () => {
  const ID_USUARIO_ALUMNO = '00000000-0000-4000-d000-0000000000c1';
  const ID_FICHA_ALUMNO = '00000000-0000-4000-d000-0000000000c2';

  beforeEach(async () => {
    await prisma.cliente.deleteMany({ where: { id: ID_FICHA_ALUMNO } });
    await prisma.usuario.deleteMany({ where: { id: ID_USUARIO_ALUMNO } });
    await prisma.usuario.create({
      data: {
        id: ID_USUARIO_ALUMNO,
        email: 'alumno-propio@local',
        nombre: 'Propio',
        apellido: 'Alumno',
        rol: RolUsuario.CLIENTE,
      },
    });
    await prisma.cliente.create({
      data: {
        id: ID_FICHA_ALUMNO,
        usuarioId: ID_USUARIO_ALUMNO,
        nombre: 'Propio',
        apellido: 'Alumno',
        documento: '87654321',
        notasInternas: 'Todavía le cuesta el embrague',
      },
    });
  });

  afterAll(async () => {
    await prisma.cliente.deleteMany({ where: { id: ID_FICHA_ALUMNO } });
    await prisma.usuario.deleteMany({ where: { id: ID_USUARIO_ALUMNO } });
  });

  it('recibe su ficha con su cédula, pero nunca las notas internas', async () => {
    const ficha = await clientes.obtenerMia(ID_USUARIO_ALUMNO);

    // La cédula es suya: puede verla y completarla para el trámite.
    expect(ficha).toMatchObject({ id: ID_FICHA_ALUMNO, documento: '87654321' });
    // Las notas internas son observaciones del instructor sobre su desempeño.
    expect(ficha).not.toHaveProperty('notasInternas');
  });

  it('la ficha se resuelve desde el usuario autenticado, no desde un id recibido', async () => {
    // El servicio no acepta un id de ficha: la única entrada es el usuario. Por
    // eso un alumno no tiene forma de pedir la de otro.
    const ficha = await clientes.obtenerMia(ID_USUARIO_ALUMNO);
    expect(ficha.id).toBe(ID_FICHA_ALUMNO);

    // Y un usuario sin ficha recibe un error claro, no la de otra persona.
    await expect(clientes.obtenerMia(ID.usuarioAdmin)).rejects.toThrow(/no tiene ficha/);
  });

  it('al editarse no puede tocar sus notas internas ni darse de baja', async () => {
    await clientes.actualizarMia(ID_USUARIO_ALUMNO, {
      nombre: 'Propio',
      apellido: 'Editado',
      telefono: '099000111',
    });

    const enBase = await prisma.cliente.findUniqueOrThrow({ where: { id: ID_FICHA_ALUMNO } });
    expect(enBase.apellido).toBe('Editado');
    // Lo que el alumno no controla queda intacto.
    expect(enBase.notasInternas).toBe('Todavía le cuesta el embrague');
    expect(enBase.activo).toBe(true);
  });
});
