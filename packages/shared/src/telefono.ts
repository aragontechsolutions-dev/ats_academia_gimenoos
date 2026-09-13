/**
 * Convertir un teléfono guardado en el número que quiere `wa.me`.
 *
 * Vive acá porque lo necesitan el panel —para mandarle el acceso a un alumno— y
 * el sitio público —para su botón de contacto—, y antes había una copia en cada
 * lado. Dos copias de esto se desincronizan solas y el síntoma es un enlace que
 * abre un chat con un número que no existe: nadie ve un error.
 *
 * Las REGLAS de qué es un teléfono válido no están acá: están en la API, en
 * `common/formato/telefono.ts`, que es donde se guardan los datos. Repetirlas
 * sería el mismo problema una capa más abajo. Acá solo se convierte lo que ya
 * está guardado, y se rechaza lo que no se puede convertir con seguridad.
 *
 * (El paquete se publica como TypeScript crudo y lo transpila cada
 * empaquetador. Node no puede cargarlo tal cual, así que la API no lo importa.)
 */

/**
 * El número como lo quiere `wa.me`: solo dígitos, con código de país y sin `+`.
 *
 * Los teléfonos se guardan normalizados, como `+598 98663201`. De ahí salen los
 * dígitos y listo.
 *
 * **Lo que NO hace, y es el punto:** no acepta un número sin código de país.
 * `092331784` es un celular uruguayo bien escrito, y quitándole los símbolos
 * quedan nueve dígitos que `wa.me` toma como un número de otro país. El enlace
 * se arma igual, abre un chat con cualquiera y nadie se entera. Antes que eso,
 * acá se devuelve null y quien llama no dibuja el botón.
 *
 * | Guardado          | Devuelve        | Por qué |
 * |-------------------|-----------------|---------|
 * | `+598 98663201`   | `59898663201`   | Normalizado, con código de país |
 * | `+5511999999999`  | `5511999999999` | Extranjero, con su código |
 * | `59899123456`     | `59899123456`   | Sin `+`, pero el largo solo da con código |
 * | `092331784`       | `null`          | Nueve dígitos sin código: no se sabe de dónde es |
 * | `98663201`        | `null`          | Ídem |
 */
export function digitosParaWhatsApp(entrada: string | null | undefined): string | null {
  if (!entrada) return null;

  const digitos = entrada.replace(/\D/g, '');
  if (digitos === '') return null;

  // Más de 15 no existe: E.164 topea ahí.
  if (digitos.length > 15) return null;

  // Con `+` delante, quien lo guardó ya dijo que incluye el código de país.
  if (entrada.trim().startsWith('+')) return digitos.length >= 8 ? digitos : null;

  // Sin `+`, solo se acepta si el largo no deja lugar a dudas. Ningún país tiene
  // números nacionales de diez dígitos o más sin código; ocho o nueve, sí
  // —Uruguay entre ellos—, y ahí es donde se cuela el error.
  return digitos.length >= 10 ? digitos : null;
}
