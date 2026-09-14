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
import { AuditoriaService } from '../src/common/auditoria/auditoria.service';
import { UsuariosService } from '../src/modules/usuarios/usuarios.service';
import { InvitacionesService } from '../src/modules/invitaciones/invitaciones.service';
import type { SupabaseAdminService } from '../src/common/supabase/supabase-admin.service';
import type { SupabaseJwtPayload } from '../src/common/auth/jwt-payload.interface';

const prisma = new PrismaService();

/** ConfigService de mentira: solo hace falta para la puerta de arranque. */
const configCon = (valores: Record<string, string | undefined>) =>
  ({ get: (clave: string) => valores[clave] }) as unknown as ConfigService;

const auditoria = new AuditoriaService(prisma);
const usuarios = new UsuariosService(prisma, configCon({}), auditoria);

const SUFIJO = '@prueba-invitacion.uy';
/** Quien figura como autor de las invitaciones en estas pruebas. */
const ID_ADMIN = '00000000-0000-4000-e000-0000000000ad';
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
    const conArranque = new UsuariosService(prisma, configCon({ ADMIN_INICIAL_EMAIL: email }), auditoria);

    const autenticado = await conArranque.resolverDesdeToken(tokenDe(nuevoId(), email));
    expect(autenticado.rol).toBe(RolUsuario.ADMIN);
  });

  it('no deja entrar a ninguna otra dirección', async () => {
    const conArranque = new UsuariosService(
      prisma,
      configCon({ ADMIN_INICIAL_EMAIL: `jefe${SUFIJO}` }),
      auditoria,
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

describe('Entrega del acceso por enlace, para mandar por WhatsApp', () => {
  /**
   * El enlace es una credencial: quien lo tenga entra como esa persona. Estas
   * pruebas verifican que quede constancia de QUE se entregó y por dónde, y que
   * el enlace en sí no aparezca en ningún lado.
   */
  it('la invitación guarda el canal, pero nunca el enlace', async () => {
    const email = `porenlace${SUFIJO}`;
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Por', apellido: 'Enlace', email, telefono: '+598 98663201' },
    });
    const invitacion = await prisma.invitacion.create({
      data: {
        email,
        rol: RolUsuario.CLIENTE,
        clienteId: cliente.id,
        enviadaAt: new Date(),
        canal: 'ENLACE',
      },
    });

    const guardada = await prisma.invitacion.findUniqueOrThrow({ where: { id: invitacion.id } });
    expect(guardada.canal).toBe('ENLACE');

    // Ninguna columna de texto puede estar guardando una dirección: si mañana
    // alguien agrega un campo y mete el enlace ahí, esta prueba lo delata.
    const comoTexto = JSON.stringify(guardada);
    expect(comoTexto).not.toMatch(/https?:\/\//);
    expect(comoTexto).not.toMatch(/access_token|token_hash/);
  });

  it('la base no acepta una entrega sin canal, ni un canal sin entrega', async () => {
    const email = `incoherente${SUFIJO}`;
    const cliente = await prisma.cliente.create({
      data: { nombre: 'In', apellido: 'Coherente', email },
    });

    await expect(
      prisma.invitacion.create({
        data: { email, rol: RolUsuario.CLIENTE, clienteId: cliente.id, enviadaAt: new Date() },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.invitacion.create({
        data: { email, rol: RolUsuario.CLIENTE, clienteId: cliente.id, canal: 'CORREO' },
      }),
    ).rejects.toThrow();
  });
});

describe('Cada rol entra por su propia aplicación', () => {
  /**
   * Antes de que existiera la app del instructor, un instructor invitado caía en
   * el panel: era el único lugar donde podía trabajar. Ahora tiene el suyo, y
   * mandarlo al panel sería mandarlo a una pantalla que ya no le corresponde.
   *
   * Se mira el destino que recibe Supabase, que es el que termina en el enlace.
   */
  const APPS = {
    APP_ALUMNO_URL: 'https://alumnos.ejemplo.uy',
    APP_INSTRUCTOR_URL: 'https://instructores.ejemplo.uy',
    APP_PANEL_URL: 'https://panel.ejemplo.uy',
  };

  /** Anota a dónde se pidió mandar a la persona y corta ahí. */
  function servicioQueAnotaElDestino() {
    const destinos: string[] = [];
    const supabase = {
      invitar: async (_email: string, destino: string) => {
        destinos.push(destino);
      },
    } as unknown as SupabaseAdminService;
    return {
      destinos,
      invitaciones: new InvitacionesService(prisma, auditoria, supabase, configCon(APPS)),
    };
  }

  it('un alumno va a la app de alumnos', async () => {
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Destino', apellido: 'Alumno', email: `destalumno${SUFIJO}` },
    });
    const { destinos, invitaciones } = servicioQueAnotaElDestino();

    await invitaciones.crear({ rol: RolUsuario.CLIENTE, clienteId: cliente.id }, ID_ADMIN);
    expect(destinos).toEqual([APPS.APP_ALUMNO_URL]);
  });

  it('un instructor va a la app de instructores, NO al panel', async () => {
    const instructor = await prisma.instructor.create({
      data: { nombre: 'Destino', apellido: 'Instructor' },
    });
    const { destinos, invitaciones } = servicioQueAnotaElDestino();

    await invitaciones.crear(
      { rol: RolUsuario.INSTRUCTOR, instructorId: instructor.id, email: `destinst${SUFIJO}` },
      ID_ADMIN,
    );
    expect(destinos).toEqual([APPS.APP_INSTRUCTOR_URL]);
    expect(destinos).not.toContain(APPS.APP_PANEL_URL);
  });

  it('administración va al panel', async () => {
    const { destinos, invitaciones } = servicioQueAnotaElDestino();

    await invitaciones.crear({ rol: RolUsuario.ADMIN, email: `destadmin${SUFIJO}` }, ID_ADMIN);
    expect(destinos).toEqual([APPS.APP_PANEL_URL]);
  });

  it('los tres destinos son distintos entre sí', async () => {
    // Si alguien cargara la misma dirección en dos variables, las pruebas de
    // arriba pasarían igual y no se estaría comprobando nada.
    expect(new Set(Object.values(APPS)).size).toBe(3);
  });
});

describe('Un enlace que no lleva a ninguna parte no se manda', () => {
  /**
   * Si `APP_ALUMNO_URL` queda sin cargar en el servidor, el destino cae en
   * `localhost`. La invitación saldría igual y la persona recibiría un enlace
   * que la lleva a su propia computadora: falla en silencio, y del lado de quien
   * menos puede entender por qué.
   */
  const supabaseQueNuncaSeUsa = {
    invitar: async () => {
      throw new Error('no debería llegar a pedirle nada a Supabase');
    },
    generarEnlace: async () => {
      throw new Error('no debería llegar a pedirle nada a Supabase');
    },
  } as unknown as SupabaseAdminService;

  const servicioCon = (valores: Record<string, string | undefined>) =>
    new InvitacionesService(prisma, auditoria, supabaseQueNuncaSeUsa, configCon(valores));

  it('en producción, un destino local corta el envío con un mensaje claro', async () => {
    const email = `destinolocal${SUFIJO}`;
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Destino', apellido: 'Local', email },
    });

    const invitaciones = servicioCon({
      NODE_ENV: 'production',
      APP_ALUMNO_URL: 'http://localhost:5175',
    });

    await expect(
      invitaciones.crear({ rol: RolUsuario.CLIENTE, clienteId: cliente.id }, ID_ADMIN),
    ).rejects.toThrow(/APP_ALUMNO_URL/);
  });

  it('con una dirección real sigue de largo y llega hasta Supabase', async () => {
    const email = `destinoreal${SUFIJO}`;
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Destino', apellido: 'Real', email },
    });

    const invitaciones = servicioCon({
      NODE_ENV: 'production',
      APP_ALUMNO_URL: 'https://app.ejemplo.uy',
    });

    // El stub de Supabase avisa que lo llamaron: eso prueba que el destino pasó
    // el control y que el corte no se lleva puesto el caso bueno.
    await expect(
      invitaciones.crear({ rol: RolUsuario.CLIENTE, clienteId: cliente.id }, ID_ADMIN),
    ).rejects.toThrow(/no debería llegar a pedirle nada a Supabase/);
  });

  it('en desarrollo, localhost es lo normal y no molesta', async () => {
    const email = `destinodev${SUFIJO}`;
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Destino', apellido: 'Dev', email },
    });

    const invitaciones = servicioCon({
      NODE_ENV: 'development',
      APP_ALUMNO_URL: 'http://localhost:5175',
    });

    await expect(
      invitaciones.crear({ rol: RolUsuario.CLIENTE, clienteId: cliente.id }, ID_ADMIN),
    ).rejects.toThrow(/no debería llegar a pedirle nada a Supabase/);
  });
});
