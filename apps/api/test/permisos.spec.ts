/**
 * Quién puede llamar a qué.
 *
 * Se lee el decorador `@Roles` y no se llama al servicio, y el motivo importa:
 * varios servicios dejan pasar a quien la fila le pertenece —un alumno sobre SU
 * propia clase, por ejemplo—, así que en esos casos el decorador es lo único que
 * separa a un rol de otro. Llamar al servicio pasaría y no probaría nada.
 *
 * Estas pruebas fijan el resultado de la Etapa 2.D: el instructor trabaja en su
 * propia app y ya no entra al panel, así que la API dejó de abrirle lo que solo
 * el panel usaba.
 */
import { RolUsuario } from '@prisma/client';

import { ROLES_REQUERIDOS } from '../src/common/auth/roles.decorator';
import { AgendaController } from '../src/modules/agenda/agenda.controller';
import { ClientesController } from '../src/modules/clientes/clientes.controller';
import { InstructoresController } from '../src/modules/instructores/instructores.controller';
import { VehiculosController } from '../src/modules/vehiculos/vehiculos.controller';

/** Los roles declarados en un método, o los de la clase si el método no dice nada. */
function rolesDe(Controlador: new (...args: never[]) => object, metodo: string): RolUsuario[] {
  const handler = (Controlador.prototype as Record<string, unknown>)[metodo];
  // Sin esto, un nombre mal escrito falla con un error de `reflect-metadata`
  // que no dice cuál es el método que no existe.
  if (typeof handler !== 'function') {
    throw new Error(`${Controlador.name} no tiene el método ${metodo}`);
  }
  const enElMetodo = Reflect.getMetadata(ROLES_REQUERIDOS, handler as object) as
    | RolUsuario[]
    | undefined;
  if (enElMetodo) return enElMetodo;
  return (Reflect.getMetadata(ROLES_REQUERIDOS, Controlador) as RolUsuario[] | undefined) ?? [];
}

/** Todos los métodos del controlador, sin el constructor. */
function metodosDe(Controlador: new (...args: never[]) => object): string[] {
  return Object.getOwnPropertyNames(Controlador.prototype).filter((n) => n !== 'constructor');
}

describe('Lo que un instructor todavía puede hacer', () => {
  it('cerrar una clase y anotar cómo fue', () => {
    for (const metodo of ['cambiarEstado', 'guardarNota']) {
      expect(rolesDe(AgendaController, metodo)).toContain(RolUsuario.INSTRUCTOR);
    }
  });

  it('y ver su agenda, que no pide ningún rol: la acota el servicio', () => {
    // `listarReservas` y `obtenerReserva` no llevan `@Roles` porque los usan los
    // tres roles; lo que cambia es QUÉ devuelven, y eso lo decide el servicio
    // según quién consulta.
    for (const metodo of ['listarReservas', 'obtenerReserva']) {
      expect(rolesDe(AgendaController, metodo)).toEqual([]);
    }
  });
});

describe('Lo que dejó de poder hacer: lo que solo existía en el panel', () => {
  const CERRADOS: Array<[string, new (...args: never[]) => object, string[]]> = [
    ['alumnos', ClientesController, ['listar', 'obtener']],
    ['instructores', InstructoresController, ['listar', 'obtener']],
    ['vehículos', VehiculosController, ['listar', 'obtener']],
  ];

  for (const [nombre, Controlador, metodos] of CERRADOS) {
    it(`${nombre}: ya no admite INSTRUCTOR`, () => {
      for (const metodo of metodos) {
        expect(rolesDe(Controlador, metodo)).toEqual([RolUsuario.ADMIN]);
      }
    });
  }

  it('NINGÚN método de esos tres controladores admite INSTRUCTOR', () => {
    // Más fuerte que la lista de arriba: si mañana se agrega un endpoint y se lo
    // abre al instructor sin querer, esto lo delata.
    for (const [nombre, Controlador] of CERRADOS) {
      for (const metodo of metodosDe(Controlador)) {
        expect({ nombre, metodo, roles: rolesDe(Controlador, metodo) }).toEqual({
          nombre,
          metodo,
          roles: expect.not.arrayContaining([RolUsuario.INSTRUCTOR]),
        });
      }
    }
  });
});

describe('La agenda: cada rol solo lo que le corresponde', () => {
  /**
   * La matriz completa del controlador de agenda. Es la tabla que hay que mirar
   * y actualizar a propósito: un endpoint sin `@Roles` queda abierto a los tres
   * roles, y eso tiene que ser una decisión, no un olvido.
   */
  const MATRIZ: Array<[string, RolUsuario[], string]> = [
    ['consultarDisponibilidad', [RolUsuario.ADMIN, RolUsuario.CLIENTE], 'el instructor no agenda'],
    ['crearReserva', [RolUsuario.ADMIN, RolUsuario.CLIENTE], 'agendar es de la academia y del alumno'],
    ['reprogramarReserva', [RolUsuario.ADMIN], 'mover una clase toca la agenda de otros'],
    ['cambiarEstado', [RolUsuario.ADMIN, RolUsuario.INSTRUCTOR], 'cerrar la clase es del que la da'],
    ['guardarNota', [RolUsuario.ADMIN, RolUsuario.INSTRUCTOR], 'el alumno no se escribe su propia nota'],
    ['listarReservas', [], 'los tres, acotado por el servicio'],
    ['obtenerReserva', [], 'los tres, acotado por el servicio'],
    ['cancelarReserva', [], 'los tres cancelan legítimamente'],
  ];

  for (const [metodo, esperados, porQue] of MATRIZ) {
    it(`${metodo}: ${esperados.length ? esperados.join(' y ') : 'sin @Roles'} — ${porQue}`, () => {
      expect(rolesDe(AgendaController, metodo).sort()).toEqual([...esperados].sort());
    });
  }

  it('la matriz cubre TODOS los métodos del controlador', () => {
    // Sin esto, un endpoint nuevo entraría sin que nadie decidiera su rol.
    expect(metodosDe(AgendaController).sort()).toEqual(MATRIZ.map(([m]) => m).sort());
  });

  it('un INSTRUCTOR no puede agendar ni reprogramar', () => {
    // Lo que esta etapa vino a cerrar, dicho de la forma en que importa.
    for (const metodo of ['crearReserva', 'reprogramarReserva', 'consultarDisponibilidad']) {
      expect(rolesDe(AgendaController, metodo)).not.toContain(RolUsuario.INSTRUCTOR);
    }
  });

  it('un ALUMNO no puede cerrar una clase ni reprogramarla', () => {
    for (const metodo of ['cambiarEstado', 'guardarNota', 'reprogramarReserva']) {
      expect(rolesDe(AgendaController, metodo)).not.toContain(RolUsuario.CLIENTE);
    }
  });
});

describe('Lo que el cambio NO se llevó puesto', () => {
  it('el alumno sigue siendo dueño de su propia ficha', () => {
    // `/clientes` pasó a ser solo de administración a nivel de clase. Los dos
    // métodos del alumno tienen su propio `@Roles`, que manda sobre el de la
    // clase porque el guard usa `getAllAndOverride`. Si eso cambiara, la app del
    // alumno dejaría de funcionar sin ningún aviso.
    for (const metodo of ['obtenerMia', 'actualizarMia']) {
      expect(rolesDe(ClientesController, metodo)).toEqual([RolUsuario.CLIENTE]);
    }
  });

  it('administración conserva todo', () => {
    for (const [Controlador, metodos] of [
      [ClientesController, ['listar', 'obtener', 'crear', 'actualizar']],
      [InstructoresController, ['listar', 'obtener', 'crear', 'actualizar']],
      [VehiculosController, ['listar', 'obtener', 'crear', 'actualizar']],
    ] as Array<[new (...args: never[]) => object, string[]]>) {
      for (const metodo of metodos) {
        expect(rolesDe(Controlador, metodo)).toContain(RolUsuario.ADMIN);
      }
    }
  });
});
