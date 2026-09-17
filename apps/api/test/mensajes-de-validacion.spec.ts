/**
 * Los errores de validación se leen en español.
 *
 * Importa porque estos mensajes no quedan en un registro: van a un aviso en la
 * pantalla de quien administra la academia. «nombre must be longer than or
 * equal to 2 characters» no es algo que se le pueda mostrar a nadie.
 */
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsString, validateSync } from 'class-validator';

import { erroresDeValidacionEnEspanol } from '../src/common/validacion/mensajes-de-validacion';
import { CrearClienteDto } from '../src/modules/clientes/dto/cliente.dto';
import { CrearReservaDto } from '../src/modules/agenda/dto/crear-reserva.dto';
import { CrearVehiculoDto } from '../src/modules/vehiculos/dto/vehiculo.dto';

/** Los mensajes que devolvería la API para ese cuerpo. */
function mensajesDe(Dto: unknown, cuerpo: Record<string, unknown>): string[] {
  const errores = validateSync(plainToInstance(Dto as never, cuerpo));
  const respuesta = erroresDeValidacionEnEspanol(errores).getResponse() as { message: string[] };
  return respuesta.message;
}

describe('Ningún mensaje queda en inglés', () => {
  const EN_INGLES = /\b(must|should|be|than|equal|following|values|instance|integer|string)\b/;

  it('el alta de un alumno con todo mal', () => {
    const mensajes = mensajesDe(CrearClienteDto, { nombre: 'a', apellido: '', email: 'no-va' });
    expect(mensajes.length).toBeGreaterThan(0);
    for (const m of mensajes) expect(m).not.toMatch(EN_INGLES);
  });

  it('el alta de una clase con todo mal', () => {
    const mensajes = mensajesDe(CrearReservaDto, {
      instructorId: 'no-es-uuid',
      vehiculoId: 'tampoco',
      tipo: 'BICICLETA',
      duracionMin: 5,
      inicio: 'cualquier cosa',
    });
    expect(mensajes.length).toBeGreaterThan(0);
    for (const m of mensajes) expect(m).not.toMatch(EN_INGLES);
  });
});

describe('Cada regla dice lo que de verdad pasa', () => {
  it('el largo mínimo nombra el mínimo', () => {
    expect(mensajesDe(CrearClienteDto, { nombre: 'a', apellido: 'Perez' }).join(' ')).toMatch(
      /nombre tiene que tener (al menos 2 caracteres|entre 2 y \d+ caracteres)/,
    );
  });

  it('un enum enumera los valores posibles', () => {
    const mensajes = mensajesDe(CrearReservaDto, {
      instructorId: '00000000-0000-4000-8000-000000000001',
      tipo: 'BICICLETA',
      inicio: new Date(),
      duracionMin: 45,
    });
    expect(mensajes.join(' ')).toMatch(/tipo tiene que ser uno de: .*AUTO/);
  });

  it('un mínimo numérico nombra el número', () => {
    const mensajes = mensajesDe(CrearReservaDto, {
      instructorId: '00000000-0000-4000-8000-000000000001',
      tipo: 'AUTO',
      inicio: new Date(),
      duracionMin: 5,
    });
    expect(mensajes.join(' ')).toMatch(/duracionMin no puede ser menor que 15/);
  });

  it('un identificador mal formado no habla de UUID', () => {
    const mensajes = mensajesDe(CrearReservaDto, {
      instructorId: 'no-es-uuid',
      tipo: 'AUTO',
      inicio: new Date(),
      duracionMin: 45,
    });
    expect(mensajes.join(' ')).toMatch(/instructorId no es un identificador válido/);
    expect(mensajes.join(' ')).not.toMatch(/UUID/);
  });
});

describe('Los mensajes propios de los DTO se respetan', () => {
  // Dicen más que cualquier traducción genérica: se distinguen porque los de
  // fábrica empiezan con el nombre del campo y estos no.
  it('la patente conserva su explicación', () => {
    const mensajes = mensajesDe(CrearVehiculoDto, { patente: '$$', tipo: 'AUTO' });
    expect(mensajes.join(' ')).toMatch(/La patente debe tener entre 6 y 10 caracteres/);
  });

  it('el correo del alumno conserva la suya', () => {
    const mensajes = mensajesDe(CrearClienteDto, { nombre: 'Ana', apellido: 'Perez', email: 'x' });
    expect(mensajes.join(' ')).toMatch(/El correo no tiene un formato válido/);
  });
});

describe('La forma de la respuesta no cambia', () => {
  it('sigue siendo una lista, una entrada por problema', () => {
    const mensajes = mensajesDe(CrearClienteDto, { nombre: 'a', apellido: 'b' });
    expect(Array.isArray(mensajes)).toBe(true);
    expect(mensajes.length).toBeGreaterThanOrEqual(2);
  });

  it('si no hay nada que decir, igual dice algo', () => {
    const respuesta = erroresDeValidacionEnEspanol([]).getResponse() as { message: string[] };
    expect(respuesta.message).toEqual(['Los datos enviados no son válidos']);
  });
});

describe('mensajes propios que empiezan con el nombre del campo', () => {
  /**
   * La regresión que encontró esto: el DTO del clic de WhatsApp dice «seccion no
   * es una de las secciones del sitio», que empieza con el nombre del campo. Con
   * el discriminador viejo se tomaba por un mensaje de fábrica y salía traducido
   * a «seccion tiene que ser uno de: uno de los valores permitidos».
   */
  class ConMensajePropio {
    @IsEnum(['a', 'b'], { message: 'seccion no es una de las secciones del sitio' })
    seccion!: string;

    @IsString({ message: 'nombre no puede quedar vacío' })
    nombre!: string;
  }

  it('sobreviven intactos', () => {
    const mensajes = mensajesDe(ConMensajePropio, { seccion: 'z', nombre: 42 });
    expect(mensajes).toContain('seccion no es una de las secciones del sitio');
    expect(mensajes).toContain('nombre no puede quedar vacío');
  });

  it('y no se cuelan traducciones a medias', () => {
    const mensajes = mensajesDe(ConMensajePropio, { seccion: 'z', nombre: 42 });
    expect(mensajes.join(' ')).not.toContain('uno de los valores permitidos');
  });
});
