/**
 * Explica, donde se ingresa, que ingresar es cosa de una sola vez.
 *
 * Existe porque la pregunta ya apareció en la práctica: como el primer acceso
 * llega por una invitación que vence a las 24 horas y se usa una sola vez, es
 * natural pensar que hay que pedir una invitación nueva cada vez. No es así.
 *
 * Lo que de verdad pasa, y es lo que este texto pone por escrito:
 *
 * - La invitación se exige **solo la primera vez**. Después la cuenta ya existe
 *   en la base y el acceso deja de mirarla
 *   (`apps/api/src/modules/usuarios/usuarios.service.ts`, `aprovisionar`).
 * - La app guarda la sesión y renueva el token sola, así que no hay que volver a
 *   ingresar cada día.
 * - Si igual se pierde la sesión —teléfono nuevo, datos borrados—, el enlace se
 *   pide desde acá, sin depender de que alguien de la academia esté disponible.
 *
 * Instalarla en el teléfono no es un adorno: en el navegador, y sobre todo en
 * iPhone, los datos del sitio pueden borrarse tras un tiempo sin usarlo, y ahí
 * sí habría que volver a ingresar. Instalada, eso no pasa.
 */
export function ComoNoVolverAEntrar() {
  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Esto se hace una sola vez</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        La app te deja la sesión abierta: no vas a tener que volver a ingresar cada día. Y si
        alguna vez se cierra, pedite el enlace acá mismo —no hace falta que la academia te
        invite de nuevo—.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        <span className="font-medium text-slate-900">Instalala en el teléfono</span> para que no
        se cierre sola: en Android, «Agregar a pantalla de inicio» desde el menú del navegador;
        en iPhone, el botón de compartir y «Agregar a inicio».
      </p>
    </div>
  );
}
