/**
 * Pruebas del ingreso por invitación.
 *
 * Es el control de acceso del sistema entero: si esto falla, entra gente que no
 * debería o se le entrega a alguien la ficha de otra persona. Por eso las
 * pruebas atacan sobre todo los casos que ANTES pasaban y no deberían.
 */
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoInvitacion, RolUsuario } from '@prisma/client';

import { PrismaService } from '../src/common/prisma/prisma.service';
import { UsuariosService } from '../src/modules/usuarios/usuarios.service';
import type { SupabaseJwtPayload } from '../src/common/auth/jwt-payload.interface';

const prisma = new PrismaService();

/** ConfigService de mentira: solo hace falta para la puerta de arranque. */
const configCon = (valores: Record<string, string | undefined>) =>
  ({ get: (clave: string) => valores[clave] }) as unknown as ConfigService;

const usuarios = new UsuariosService(prisma, configCon({}));

const SUFIJO = '@prueba-invitacion.uy';
const tokenDe = (sub: string, email: string): SupabaseJwtPayload => ({
  sub,
  email,
  // El token dice ADMIN a propósito en todas las pruebas: el rol NO se lee de
  // acá, y si alguna vez se leyera, estas pruebas lo delatarían.
  app_metadata: { rol: RolUsuario.ADMIN },
});

const creados: string[] = [];
const nuevoId = () => {
  const id = `00000000-0000-4000-e000-${String(creados.length + 1).padStart(12, '0')}`;
  creados.push(id);
  return id;
};

async function limpiar() {
  await prisma.invitacion.deleteMany({ where: { email: { contains: SUFIJO } } });
  await prisma.cliente.deleteMany({ where: { email: { contains: SUFIJO } } });
  await prisma.instructor.deleteMany({ where: { nombre: 'PruebaInvitacion' } });
  await prisma.registroAuditoria.deleteMany({ where: { usuarioId: { in: creados } } });
  await prisma.usuario.deleteMany({ where: { id: { in: creados } } });
}

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await limpiar();
  creados.length = 0;
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('Sin invitación no se entra', () => {
  it('un token válido de alguien desconocido es rechazado', async () => {
    const sub = nuevoId();
    await expect(usuarios.resolverDesdeToken(tokenDe(sub, `intruso${SUFIJO}`))).rejects.toThrow(
      ForbiddenException,
    );

    // Y no deja rastro: ni cuenta ni ficha de alumno vacía, que es lo que pasaba antes.
    expect(await prisma.usuario.findUnique({ where: { id: sub } })).toBeNull();
    expect(await prisma.cliente.count({ where: { email: `intruso${SUFIJO}` } })).toBe(0);
  });

  it('una invitación revocada no sirve', async () => {
    const email = `revocado${SUFIJO}`;
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Rev', apellido: 'Ocado', email },
    });
    await prisma.invitacion.create({
      data: { email, rol: RolUsuario.CLIENTE, clienteId: cliente.id, estado: EstadoInvitacion.REVOCADA },
    });

    await expect(usuarios.resolverDesdeToken(tokenDe(nuevoId(), email))).rejects.toThrow(
      /no está habilitada/,
    );
  });

  it('una invitación ya usada no sirve para una segunda cuenta', async () => {
    const email = `usadados${SUFIJO}`;
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Una', apellido: 'Vez', email },
    });
    await prisma.invitacion.create({
      data: { email, rol: RolUsuario.CLIENTE, clienteId: cliente.id },
    });

    await usuarios.resolverDesdeToken(tokenDe(nuevoId(), email));
    // Otra cuenta de Supabase, el mismo correo: la invitación ya se consumió.
    await expect(usuarios.resolverDesdeToken(tokenDe(nuevoId(), email))).rejects.toThrow();
  });
});

describe('Con invitación, la ficha queda atada sin adivinar', () => {
  it('vincula la ficha que dice la invitación, no la que coincide por correo', async () => {
    const email = `ambiguo${SUFIJO}`;
    // Dos fichas con el MISMO correo: antes esto dejaba al sistema sin saber
    // cuál vincular y creaba una tercera ficha.
    const otra = await prisma.cliente.create({ data: { nombre: 'Otra', apellido: 'Persona', email } });
    const correcta = await prisma.cliente.create({
      data: { nombre: 'Lucía', apellido: 'Pereira', email, telefono: '+598 98663201' },
    });
    await prisma.invitacion.create({
      data: { email, rol: RolUsuario.CLIENTE, clienteId: correcta.id },
    });

    const sub = nuevoId();
    const autenticado = await usuarios.resolverDesdeToken(tokenDe(sub, email));
    expect(autenticado.rol).toBe(RolUsuario.CLIENTE);

    expect((await prisma.cliente.findUniqueOrThrow({ where: { id: correcta.id } })).usuarioId).toBe(sub);
    expect((await prisma.cliente.findUniqueOrThrow({ where: { id: otra.id } })).usuarioId).toBeNull();
    // Y no se creó ninguna ficha de más.
    expect(await prisma.cliente.count({ where: { email } })).toBe(2);
  });

  it('el nombre sale de la ficha y no queda vacío', async () => {
    const email = `connombre${SUFIJO}`;
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Lucía', apellido: 'Pereira', email, telefono: '+598 98663201' },
    });
    await prisma.invitacion.create({ data: { email, rol: RolUsuario.CLIENTE, clienteId: cliente.id } });

    const sub = nuevoId();
    await usuarios.resolverDesdeToken(tokenDe(sub, email));

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: sub } });
    expect(usuario).toMatchObject({ nombre: 'Lucía', apellido: 'Pereira', telefono: '+598 98663201' });
  });

  it('el rol sale de la invitación, nunca del token', async () => {
    const email = `rolinvitacion${SUFIJO}`;
    const cliente = await prisma.cliente.create({ data: { nombre: 'Rol', apellido: 'Prueba', email } });
    await prisma.invitacion.create({ data: { email, rol: RolUsuario.CLIENTE, clienteId: cliente.id } });

    // El token dice ADMIN. La invitación dice CLIENTE. Gana la invitación.
    const autenticado = await usuarios.resolverDesdeToken(tokenDe(nuevoId(), email));
    expect(autenticado.rol).toBe(RolUsuario.CLIENTE);
  });

  it('un instructor invitado queda atado a su ficha de instructor', async () => {
    const email = `instructor${SUFIJO}`;
    const instructor = await prisma.instructor.create({
      data: { nombre: 'PruebaInvitacion', apellido: 'Docente' },
    });
    await prisma.invitacion.create({
      data: { email, rol: RolUsuario.INSTRUCTOR, instructorId: instructor.id },
    });

    const sub = nuevoId();
    const autenticado = await usuarios.resolverDesdeToken(tokenDe(sub, email));

    expect(autenticado.rol).toBe(RolUsuario.INSTRUCTOR);
    expect((await prisma.instructor.findUniqueOrThrow({ where: { id: instructor.id } })).usuarioId).toBe(sub);
  });

  it('la invitación queda marcada como aceptada, con quién la usó', async () => {
    const email = `aceptada${SUFIJO}`;
    const cliente = await prisma.cliente.create({ data: { nombre: 'Ace', apellido: 'Ptada', email } });
    const invitacion = await prisma.invitacion.create({
      data: { email, rol: RolUsuario.CLIENTE, clienteId: cliente.id },
    });

    const sub = nuevoId();
    await usuarios.resolverDesdeToken(tokenDe(sub, email));

    const despues = await prisma.invitacion.findUniqueOrThrow({ where: { id: invitacion.id } });
    expect(despues.estado).toBe(EstadoInvitacion.ACEPTADA);
    expect(despues.aceptadaPor).toBe(sub);
    expect(despues.aceptadaAt).not.toBeNull();
  });

  it('el correo se compara sin importar mayúsculas', async () => {
    const email = `mayusculas${SUFIJO}`;
    const cliente = await prisma.cliente.create({ data: { nombre: 'May', apellido: 'Usc', email } });
    await prisma.invitacion.create({ data: { email, rol: RolUsuario.CLIENTE, clienteId: cliente.id } });

    // Supabase normaliza, pero el token podría traer cualquier forma.
    const sub = nuevoId();
    await usuarios.resolverDesdeToken(tokenDe(sub, email.toUpperCase()));
    expect((await prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id } })).usuarioId).toBe(sub);
  });
});

describe('La puerta de arranque', () => {
  it('deja entrar como ADMIN solo a la dirección configurada', async () => {
    const email = `jefe${SUFIJO}`;
    const conArranque = new UsuariosService(prisma, configCon({ ADMIN_INICIAL_EMAIL: email }));

    const autenticado = await conArranque.resolverDesdeToken(tokenDe(nuevoId(), email));
    expect(autenticado.rol).toBe(RolUsuario.ADMIN);
  });

  it('no deja entrar a ninguna otra dirección', async () => {
    const conArranque = new UsuariosService(
      prisma,
      configCon({ ADMIN_INICIAL_EMAIL: `jefe${SUFIJO}` }),
    );
    await expect(
      conArranque.resolverDesdeToken(tokenDe(nuevoId(), `otro${SUFIJO}`)),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('Cuentas que ya existen', () => {
  it('una cuenta desactivada no entra, aunque su invitación esté aceptada', async () => {
    const email = `baja${SUFIJO}`;
    const cliente = await prisma.cliente.create({ data: { nombre: 'De', apellido: 'Baja', email } });
    await prisma.invitacion.create({ data: { email, rol: RolUsuario.CLIENTE, clienteId: cliente.id } });

    const sub = nuevoId();
    await usuarios.resolverDesdeToken(tokenDe(sub, email));
    await prisma.usuario.update({ where: { id: sub }, data: { activo: false } });

    await expect(usuarios.resolverDesdeToken(tokenDe(sub, email))).rejects.toThrow(/deshabilitada/);
  });

  it('otra cuenta de Supabase con un correo ya usado se rechaza con un aviso, no con un 500', async () => {
    const email = `repetido${SUFIJO}`;
    const cliente = await prisma.cliente.create({ data: { nombre: 'Rep', apellido: 'Etido', email } });
    await prisma.invitacion.create({ data: { email, rol: RolUsuario.CLIENTE, clienteId: cliente.id } });
    await usuarios.resolverDesdeToken(tokenDe(nuevoId(), email));

    // Mismo correo, id distinto: es lo que pasa si se rehace el proyecto de Supabase.
    await expect(usuarios.resolverDesdeToken(tokenDe(nuevoId(), email))).rejects.toThrow(
      /otro identificador/,
    );
  });
});
