/**
 * Pruebas de la administración de cuentas.
 *
 * Lo que se prueba acá no es que la pantalla funcione, sino que no se pueda
 * dejar al sistema sin forma de entrar. Un administrador que se desactiva a sí
 * mismo, o que le saca el rol al último que quedaba, deja la única salida en
 * entrar a la base a mano.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RolUsuario } from '@prisma/client';

import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditoriaService } from '../src/common/auditoria/auditoria.service';
import { UsuariosService } from '../src/modules/usuarios/usuarios.service';

const prisma = new PrismaService();
const usuarios = new UsuariosService(
  prisma,
  { get: () => undefined } as unknown as ConfigService,
  new AuditoriaService(prisma),
);

const SUFIJO = '@prueba-cuentas.uy';
const ID = {
  admin: '00000000-0000-4000-f000-000000000001',
  otroAdmin: '00000000-0000-4000-f000-000000000002',
  alumno: '00000000-0000-4000-f000-000000000003',
  instructor: '00000000-0000-4000-f000-000000000004',
};

/**
 * Los administradores que ya existan en la base harían pasar las pruebas del
 * "último administrador" por el motivo equivocado. Se desactivan mientras duran
 * y se reponen al final.
 */
let administradoresAjenos: string[] = [];

async function limpiar() {
  await prisma.cliente.deleteMany({ where: { usuarioId: { in: Object.values(ID) } } });
  await prisma.instructor.deleteMany({ where: { usuarioId: { in: Object.values(ID) } } });
  await prisma.registroAuditoria.deleteMany({ where: { usuarioId: { in: Object.values(ID) } } });
  await prisma.usuario.deleteMany({ where: { id: { in: Object.values(ID) } } });
}

beforeAll(async () => {
  await prisma.$connect();
  const ajenos = await prisma.usuario.findMany({
    where: { rol: RolUsuario.ADMIN, activo: true, id: { notIn: Object.values(ID) } },
    select: { id: true },
  });
  administradoresAjenos = ajenos.map((u) => u.id);
  await prisma.usuario.updateMany({
    where: { id: { in: administradoresAjenos } },
    data: { activo: false },
  });
});

beforeEach(async () => {
  await limpiar();
  await prisma.usuario.createMany({
    data: [
      { id: ID.admin, email: `admin${SUFIJO}`, nombre: 'Admin', apellido: 'Uno', rol: RolUsuario.ADMIN },
      { id: ID.otroAdmin, email: `admin2${SUFIJO}`, nombre: 'Admin', apellido: 'Dos', rol: RolUsuario.ADMIN },
      { id: ID.alumno, email: `alumno${SUFIJO}`, nombre: 'Alu', apellido: 'Mno', rol: RolUsuario.CLIENTE },
      { id: ID.instructor, email: `inst${SUFIJO}`, nombre: 'Ins', apellido: 'Tructor', rol: RolUsuario.INSTRUCTOR },
    ],
  });
  await prisma.cliente.create({
    data: { usuarioId: ID.alumno, nombre: 'Alu', apellido: 'Mno', email: `alumno${SUFIJO}` },
  });
});

afterAll(async () => {
  await limpiar();
  await prisma.usuario.updateMany({
    where: { id: { in: administradoresAjenos } },
    data: { activo: true },
  });
  await prisma.$disconnect();
});

describe('Nadie se deja afuera del sistema', () => {
  it('un administrador no puede tocar su propia cuenta', async () => {
    await expect(usuarios.actualizar(ID.admin, { activo: false }, ID.admin)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      usuarios.actualizar(ID.admin, { rol: RolUsuario.CLIENTE }, ID.admin),
    ).rejects.toThrow(/tu propia cuenta/);

    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: ID.admin } })).activo).toBe(true);
  });

  it('no se puede desactivar al último administrador activo', async () => {
    // Queda uno solo.
    await usuarios.actualizar(ID.otroAdmin, { activo: false }, ID.admin);

    await expect(usuarios.actualizar(ID.admin, { activo: false }, ID.otroAdmin)).rejects.toThrow(
      /único administrador/,
    );
  });

  it('tampoco se le puede sacar el rol al último administrador', async () => {
    await usuarios.actualizar(ID.otroAdmin, { activo: false }, ID.admin);

    await expect(
      usuarios.actualizar(ID.admin, { rol: RolUsuario.INSTRUCTOR }, ID.otroAdmin),
    ).rejects.toThrow(ConflictException);
  });

  it('con dos administradores, sacar a uno sí se permite', async () => {
    const resultado = await usuarios.actualizar(ID.otroAdmin, { activo: false }, ID.admin);
    expect(resultado.activo).toBe(false);
  });
});

describe('Un administrador no tiene ficha', () => {
  it('no se puede ascender a ADMIN a alguien con ficha de alumno', async () => {
    await expect(
      usuarios.actualizar(ID.alumno, { rol: RolUsuario.ADMIN }, ID.admin),
    ).rejects.toThrow(/no puede tener ficha/);
  });

  it('a alguien con ficha de instructor tampoco', async () => {
    await prisma.instructor.create({
      data: { usuarioId: ID.instructor, nombre: 'Ins', apellido: 'Tructor' },
    });
    await expect(
      usuarios.actualizar(ID.instructor, { rol: RolUsuario.ADMIN }, ID.admin),
    ).rejects.toThrow(/no puede tener ficha/);
  });
});

describe('Los cambios quedan registrados', () => {
  it('cambiar el rol deja auditoría con el antes y el después', async () => {
    await usuarios.actualizar(ID.alumno, { rol: RolUsuario.INSTRUCTOR }, ID.admin);

    const registro = await prisma.registroAuditoria.findFirstOrThrow({
      where: { accion: 'USUARIO_ROL_CAMBIADO', entidadId: ID.alumno },
      orderBy: { createdAt: 'desc' },
    });
    expect(registro.usuarioId).toBe(ID.admin);
    expect(registro.detalle).toMatchObject({ de: 'CLIENTE', a: 'INSTRUCTOR' });
  });

  it('dar de baja y reactivar quedan como acciones distintas', async () => {
    await usuarios.actualizar(ID.alumno, { activo: false }, ID.admin);
    await usuarios.actualizar(ID.alumno, { activo: true }, ID.admin);

    const acciones = await prisma.registroAuditoria.findMany({
      where: { entidadId: ID.alumno },
      select: { accion: true },
    });
    expect(acciones.map((a) => a.accion)).toEqual(
      expect.arrayContaining(['USUARIO_DESACTIVADO', 'USUARIO_REACTIVADO']),
    );
  });
});

describe('El listado', () => {
  it('trae la ficha vinculada, para saber de quién es cada cuenta', async () => {
    const pagina = await usuarios.listar({ q: `alumno${SUFIJO}` });
    const fila = pagina.datos.find((u) => u.id === ID.alumno);
    expect(fila?.cliente).toMatchObject({ nombre: 'Alu', apellido: 'Mno' });
  });

  it('esconde las cuentas dadas de baja salvo que se pidan', async () => {
    await usuarios.actualizar(ID.alumno, { activo: false }, ID.admin);

    const sinInactivos = await usuarios.listar({ q: `alumno${SUFIJO}` });
    expect(sinInactivos.datos.map((u) => u.id)).not.toContain(ID.alumno);

    const conInactivos = await usuarios.listar({ q: `alumno${SUFIJO}`, incluirInactivos: true });
    expect(conInactivos.datos.map((u) => u.id)).toContain(ID.alumno);
  });

  it('filtra por rol', async () => {
    const pagina = await usuarios.listar({ rol: RolUsuario.INSTRUCTOR, porPagina: 100 });
    expect(pagina.datos.every((u) => u.rol === RolUsuario.INSTRUCTOR)).toBe(true);
    expect(pagina.datos.map((u) => u.id)).toContain(ID.instructor);
  });
});
