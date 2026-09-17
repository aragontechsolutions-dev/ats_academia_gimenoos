/**
 * El inventario completo de rutas: quién puede llamar a cada una.
 *
 * Por qué existe, además de `permisos.spec.ts`: aquella prueba fija casos
 * concretos que ya se rompieron alguna vez. Esta hace la pregunta al revés
 * —**¿queda alguna ruta sin decidir?**— y es la que atrapa el olvido.
 *
 * La regla del sistema es que el guard está cerrado por omisión, así que una
 * ruta sin `@Roles` **no** queda cerrada: queda abierta a los TRES roles. Eso a
 * veces es correcto y a veces es un descuido, y desde el código no se distinguen.
 * Acá cada ruta tiene que estar en una de las tres listas de abajo, con su
 * motivo escrito. Una ruta nueva sin clasificar hace fallar esto.
 *
 * Ya pasó: en la Etapa 2.J se encontraron tres rutas de agenda abiertas a los
 * tres roles sin que nadie lo hubiera decidido. Con un instructor podía agendar
 * clases para cualquier alumno.
 */
import { RolUsuario } from '@prisma/client';

import { ES_PUBLICO } from '../src/common/auth/publico.decorator';
import { ROLES_REQUERIDOS } from '../src/common/auth/roles.decorator';

import { AgendaController } from '../src/modules/agenda/agenda.controller';
import { AvisosController } from '../src/modules/avisos/avisos.controller';
import { CatalogoController } from '../src/modules/catalogo/catalogo.controller';
import { ClientesController } from '../src/modules/clientes/clientes.controller';
import { ConfiguracionController } from '../src/modules/configuracion/configuracion.controller';
import { GraduadosController } from '../src/modules/graduados/graduados.controller';
import { HealthController } from '../src/modules/health/health.controller';
import { InstructoresController } from '../src/modules/instructores/instructores.controller';
import { InvitacionesController } from '../src/modules/invitaciones/invitaciones.controller';
import { LandingController } from '../src/modules/landing/landing.controller';
import { PushController } from '../src/modules/push/push.controller';
import { RecordatoriosController } from '../src/modules/recordatorios/recordatorios.controller';
import { UsuariosController } from '../src/modules/usuarios/usuarios.controller';
import { VehiculosController } from '../src/modules/vehiculos/vehiculos.controller';

type Controlador = new (...args: never[]) => object;

/**
 * TODOS los controladores de la API.
 *
 * Si se agrega uno y no se suma acá, la última prueba de este archivo falla:
 * compara esta lista contra los archivos del repositorio.
 */
const CONTROLADORES: Controlador[] = [
  AgendaController,
  AvisosController,
  CatalogoController,
  ClientesController,
  ConfiguracionController,
  GraduadosController,
  HealthController,
  InstructoresController,
  InvitacionesController,
  LandingController,
  PushController,
  RecordatoriosController,
  UsuariosController,
  VehiculosController,
];

/**
 * Rutas SIN sesión. Cada una tiene que poder justificarse en un renglón.
 *
 * Es la lista más delicada del sistema: lo que está acá lo puede llamar
 * cualquiera en internet, sin cuenta.
 */
const PUBLICAS: Record<string, string> = {
  'HealthController.verificar': 'Estado del servicio. No devuelve datos ni versiones.',
  'ConfiguracionController.obtenerPublica': 'Datos de contacto y políticas que muestra el sitio.',
  'CatalogoController.listarPublicos': 'Precios publicados. Están para verse.',
  'LandingController.contenido': 'Los textos del sitio público.',
  'LandingController.contactoWhatsApp':
    'Avisa que alguien tocó WhatsApp. Sección de lista cerrada y límite propio de 6/min.',
  'GraduadosController.galeria': 'Galería de egresados, solo los que autorizaron.',
  'GraduadosController.anios': 'Años con egresados, para el filtro de la galería.',
  'GraduadosController.verificar': 'Comprobar un diploma por su código. Es para lo que existe.',
  'PushController.clavePublica': 'La clave VAPID pública, que el navegador necesita para suscribirse.',
  'RecordatoriosController.procesar':
    'Lo llama una máquina, no una persona: se protege con un secreto compartido, no con sesión.',
};

/**
 * Rutas abiertas a los TRES roles, **a propósito**.
 *
 * No son «rutas sin permisos»: son rutas donde el rol no decide si se puede,
 * sino QUÉ se devuelve, y eso lo resuelve el servicio mirando de quién es cada
 * fila.
 */
const TODOS_LOS_ROLES: Record<string, string> = {
  'UsuariosController.obtenerMiPerfil':
    'Cada uno su propio perfil. Es lo que usa el guard de las tres apps.',
  'UsuariosController.actualizarMiPerfil':
    'Solo nombre, apellido y teléfono: el rol nunca se toma del cuerpo del pedido.',
  'AgendaController.listarReservas': 'El servicio acota a lo propio según quién consulta.',
  'AgendaController.obtenerReserva': 'Ídem, más la comprobación de pertenencia.',
  'AgendaController.cancelarReserva':
    'Los tres cancelan, pero solo lo propio: lo comprueba `verificarAcceso` en el servicio.',
  'PushController.suscribir': 'Cada uno registra SU navegador. El dueño sale de la sesión.',
  'PushController.desuscribir': 'Ídem: solo borra si la suscripción es de quien pide.',
};

/** Los roles declarados en un método, o los de la clase si el método no dice nada. */
function rolesDe(Controlador: Controlador, metodo: string): RolUsuario[] {
  const handler = (Controlador.prototype as Record<string, unknown>)[metodo] as object;
  const enElMetodo = Reflect.getMetadata(ROLES_REQUERIDOS, handler) as RolUsuario[] | undefined;
  if (enElMetodo) return enElMetodo;
  return (Reflect.getMetadata(ROLES_REQUERIDOS, Controlador) as RolUsuario[] | undefined) ?? [];
}

function esPublico(Controlador: Controlador, metodo: string): boolean {
  const handler = (Controlador.prototype as Record<string, unknown>)[metodo] as object;
  return Boolean(
    Reflect.getMetadata(ES_PUBLICO, handler) ?? Reflect.getMetadata(ES_PUBLICO, Controlador),
  );
}

function metodosDe(Controlador: Controlador): string[] {
  return Object.getOwnPropertyNames(Controlador.prototype).filter((n) => n !== 'constructor');
}

/** Todas las rutas del sistema, con cómo quedaron clasificadas. */
const RUTAS = CONTROLADORES.flatMap((Controlador) =>
  metodosDe(Controlador).map((metodo) => ({
    nombre: `${Controlador.name}.${metodo}`,
    publica: esPublico(Controlador, metodo),
    roles: rolesDe(Controlador, metodo),
  })),
);

describe('Ninguna ruta queda sin decidir', () => {
  it('encontró rutas: la prueba no pasa por mirar una lista vacía', () => {
    expect(RUTAS.length).toBeGreaterThan(40);
  });

  it('cada ruta pública está en la lista, con su motivo', () => {
    const publicasSinJustificar = RUTAS.filter((r) => r.publica && !PUBLICAS[r.nombre]).map(
      (r) => r.nombre,
    );
    expect(publicasSinJustificar).toEqual([]);
  });

  it('y la lista no tiene entradas que ya no correspondan a ninguna ruta pública', () => {
    // Una entrada de más es tan mala como una de menos: hace creer que algo se
    // revisó cuando en realidad se renombró o se borró.
    const publicasReales = new Set(RUTAS.filter((r) => r.publica).map((r) => r.nombre));
    const sobran = Object.keys(PUBLICAS).filter((n) => !publicasReales.has(n));
    expect(sobran).toEqual([]);
  });

  it('cada ruta abierta a los tres roles está justificada', () => {
    const abiertas = RUTAS.filter((r) => !r.publica && r.roles.length === 0).map((r) => r.nombre);
    const sinJustificar = abiertas.filter((n) => !TODOS_LOS_ROLES[n]);
    expect(sinJustificar).toEqual([]);
  });

  it('y esa lista tampoco tiene entradas viejas', () => {
    const abiertasReales = new Set(
      RUTAS.filter((r) => !r.publica && r.roles.length === 0).map((r) => r.nombre),
    );
    const sobran = Object.keys(TODOS_LOS_ROLES).filter((n) => !abiertasReales.has(n));
    expect(sobran).toEqual([]);
  });

  it('ninguna ruta es pública Y con roles a la vez', () => {
    // Si las dos cosas están puestas, `@Publico` gana y el `@Roles` es una
    // mentira que alguien va a leer como si protegiera algo.
    const contradictorias = RUTAS.filter((r) => r.publica && r.roles.length > 0).map((r) => r.nombre);
    expect(contradictorias).toEqual([]);
  });
});

describe('Lo que solo puede hacer administración', () => {
  /**
   * Rutas que tocan datos de terceros o la configuración de la academia. Si
   * alguna de estas dejara de pedir ADMIN, un alumno o un instructor con sesión
   * podría llamarla.
   */
  const SOLO_ADMIN: Array<[Controlador, string[]]> = [
    [ClientesController, ['crear', 'actualizar', 'listar', 'obtener']],
    [InstructoresController, ['crear', 'actualizar', 'listar', 'obtener', 'reemplazarDisponibilidad']],
    [VehiculosController, ['crear', 'actualizar', 'listar', 'obtener', 'guardarFoto']],
    [InvitacionesController, ['crear', 'listar', 'revocar', 'reenviar']],
    [AvisosController, ['estado', 'chats', 'actualizar', 'probar']],
    [UsuariosController, ['listar', 'actualizar']],
    [LandingController, ['listarSecciones', 'actualizarSeccion', 'obtenerNegocio', 'actualizarNegocio']],
  ];

  for (const [Controlador, metodos] of SOLO_ADMIN) {
    for (const metodo of metodos) {
      it(`${Controlador.name}.${metodo} pide ADMIN`, () => {
        const handler = (Controlador.prototype as Record<string, unknown>)[metodo];
        // Un nombre mal escrito tiene que fallar acá y no pasar en silencio.
        expect(typeof handler).toBe('function');
        expect(rolesDe(Controlador, metodo)).toEqual([RolUsuario.ADMIN]);
      });
    }
  }
});

describe('Lo que un alumno NO puede hacer', () => {
  /**
   * `crearReserva` NO está acá: el alumno sí reserva, es para lo que existe su
   * app. Lo que no puede es reservar PARA OTRO, y eso no lo decide el rol sino
   * `resolverClienteDestino` en el servicio, que le ignora el `clienteId` que
   * mande y usa el suyo. Está cubierto en `reservas.spec.ts`.
   */
  const PROHIBIDAS: Array<[Controlador, string]> = [
    [AgendaController, 'reprogramarReserva'],
    [ClientesController, 'listar'],
    [InstructoresController, 'crear'],
    [GraduadosController, 'crear'],
    [InvitacionesController, 'crear'],
    [AvisosController, 'actualizar'],
  ];

  it.each(PROHIBIDAS)('%p.%s no admite al rol CLIENTE', (Controlador, metodo) => {
    expect(rolesDe(Controlador as Controlador, metodo as string)).not.toContain(RolUsuario.CLIENTE);
  });
});

describe('Lo que un instructor NO puede hacer', () => {
  const PROHIBIDAS: Array<[Controlador, string]> = [
    [AgendaController, 'crearReserva'],
    [AgendaController, 'reprogramarReserva'],
    [AgendaController, 'consultarDisponibilidad'],
    [ClientesController, 'listar'],
    [ClientesController, 'obtener'],
    [InvitacionesController, 'crear'],
    [UsuariosController, 'listar'],
    [AvisosController, 'estado'],
  ];

  it.each(PROHIBIDAS)('%p.%s no admite al rol INSTRUCTOR', (Controlador, metodo) => {
    expect(rolesDe(Controlador as Controlador, metodo as string)).not.toContain(
      RolUsuario.INSTRUCTOR,
    );
  });
});
