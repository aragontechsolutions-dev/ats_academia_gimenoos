import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * Los errores de validación, en español.
 *
 * `class-validator` genera sus mensajes en inglés: «nombre must be longer than
 * or equal to 2 characters». Eso termina en la pantalla de quien administra la
 * academia, que no tiene por qué leer inglés ni saber qué es un «UUID».
 *
 * Se traduce **acá y no en cada decorador** por una cuestión de escala: hay más
 * de trescientos validadores repartidos en los DTO. Escribirles un `message` a
 * todos es mucho trabajo manual, se olvida en el siguiente que se agregue, y no
 * hay nada que avise cuando pasa. Traduciendo por el nombre de la regla, un DTO
 * nuevo ya sale en español sin que nadie se acuerde de nada.
 *
 * Los mensajes propios que SÍ tienen algunos DTO —«La patente debe tener entre
 * 6 y 10 caracteres alfanuméricos»— se respetan: dicen más que cualquier
 * traducción genérica. Se distinguen porque los de fábrica **empiezan con el
 * nombre del campo** y los propios no.
 */

/** Las reglas que usan los DTO de este proyecto, con su texto en español. */
const TEXTOS: Record<string, (campo: string, original: string) => string> = {
  isString: (c) => `${c} tiene que ser un texto`,
  isInt: (c) => `${c} tiene que ser un número entero`,
  isNumber: (c) => `${c} tiene que ser un número`,
  isBoolean: (c) => `${c} tiene que ser verdadero o falso`,
  isArray: (c) => `${c} tiene que ser una lista`,
  isDate: (c) => `${c} tiene que ser una fecha válida`,
  isDateString: (c) => `${c} tiene que ser una fecha válida`,
  isEmail: (c) => `${c} tiene que ser un correo válido`,
  isUuid: (c) => `${c} no es un identificador válido`,
  isHexColor: (c) => `${c} tiene que ser un color en formato #RRGGBB`,
  isNotEmpty: (c) => `${c} no puede quedar vacío`,
  isDefined: (c) => `Falta ${c}`,

  isLength: (c, original) => {
    const entre = /equal to (\d+) and shorter than or equal to (\d+)/.exec(original);
    if (entre) return `${c} tiene que tener entre ${entre[1]} y ${entre[2]} caracteres`;
    const minimo = /longer than or equal to (\d+)/.exec(original);
    if (minimo) return `${c} tiene que tener al menos ${minimo[1]} caracteres`;
    const maximo = /shorter than or equal to (\d+)/.exec(original);
    if (maximo) return `${c} no puede tener más de ${maximo[1]} caracteres`;
    return `${c} no tiene un largo válido`;
  },
  minLength: (c, original) => {
    const n = /(\d+)/.exec(original);
    return n ? `${c} tiene que tener al menos ${n[1]} caracteres` : `${c} es demasiado corto`;
  },
  maxLength: (c, original) => {
    const n = /(\d+)/.exec(original);
    return n ? `${c} no puede tener más de ${n[1]} caracteres` : `${c} es demasiado largo`;
  },
  min: (c, original) => {
    const n = /(-?\d+(?:\.\d+)?)/.exec(original);
    return n ? `${c} no puede ser menor que ${n[1]}` : `${c} es demasiado chico`;
  },
  max: (c, original) => {
    const n = /(-?\d+(?:\.\d+)?)/.exec(original);
    return n ? `${c} no puede ser mayor que ${n[1]}` : `${c} es demasiado grande`;
  },
  isEnum: (c, original) => unoDe(c, original),
  isIn: (c, original) => unoDe(c, original),
  arrayMaxSize: (c, original) => {
    const n = /(\d+)/.exec(original);
    return n ? `${c} no puede tener más de ${n[1]} elementos` : `${c} tiene demasiados elementos`;
  },
  arrayMinSize: (c, original) => {
    const n = /(\d+)/.exec(original);
    return n ? `${c} tiene que tener al menos ${n[1]} elementos` : `${c} tiene muy pocos elementos`;
  },

  // Lo lanza `forbidNonWhitelisted` cuando llega un campo que el DTO no declara.
  // No es un error de quien usa el sistema sino de quien lo programó, pero si
  // aparece conviene que se entienda.
  whitelistValidation: (c) => `${c} no es un dato que este formulario pueda mandar`,
};

/**
 * «tipo must be one of the following values: MOTO, AUTO» → «tipo tiene que ser
 * uno de: MOTO, AUTO».
 *
 * Si la lista no se puede extraer —porque class-validator cambió el texto—, se
 * arma una frase entera y no se rellena el hueco. La versión anterior devolvía
 * «tiene que ser uno de: uno de los valores permitidos», que es media oración
 * pegada a otra media y no dice nada.
 */
function unoDe(campo: string, original: string): string {
  const lista = /values:\s*(.+)$/.exec(original);
  return lista
    ? `${campo} tiene que ser uno de: ${lista[1]!.trim()}`
    : `${campo} no tiene un valor permitido`;
}

/**
 * Si el mensaje lo escribió class-validator y no una persona.
 *
 * Son dos condiciones, y la segunda se agregó después de que la primera fallara
 * sola. Un mensaje de fábrica empieza con el nombre del campo —«nombre must
 * be…», «tipo must be one of…»—, pero un mensaje propio bien escrito **también**
 * puede empezar así: «seccion no es una de las secciones del sitio» es la forma
 * natural de redactarlo, y quedaba traducido a un texto sin sentido.
 *
 * La segunda condición es la que de verdad los separa: todos los mensajes de
 * fábrica están en inglés y todos usan «must» o «should». Un mensaje escrito
 * para esta aplicación está en español y no puede contener ninguna de las dos
 * palabras sueltas.
 */
function esDeFabrica(propiedad: string, mensaje: string): boolean {
  const empiezaConElCampo =
    mensaje.startsWith(`${propiedad} `) || mensaje.startsWith(`property ${propiedad} `);
  return empiezaConElCampo && /\b(must|should)\b/.test(mensaje);
}

/** Todos los mensajes de un árbol de errores, incluidos los de objetos anidados. */
function mensajesDe(errores: ValidationError[]): string[] {
  const salida: string[] = [];

  for (const error of errores) {
    for (const [clave, original] of Object.entries(error.constraints ?? {})) {
      if (!esDeFabrica(error.property, original)) {
        salida.push(original);
        continue;
      }
      const texto = TEXTOS[clave];
      salida.push(texto ? texto(error.property, original) : original);
    }

    // `@ValidateNested`: los errores del objeto de adentro cuelgan acá.
    if (error.children?.length) salida.push(...mensajesDe(error.children));
  }

  return salida;
}

/**
 * Lo que el `ValidationPipe` global usa para armar la respuesta de un 400.
 *
 * Mantiene la forma que ya devolvía Nest —`message` como lista— porque el
 * frontend la muestra como una lista de cosas para corregir, una por campo.
 */
export function erroresDeValidacionEnEspanol(errores: ValidationError[]): BadRequestException {
  const mensajes = mensajesDe(errores);
  return new BadRequestException(mensajes.length ? mensajes : ['Los datos enviados no son válidos']);
}
