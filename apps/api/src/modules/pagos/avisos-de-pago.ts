import { escaparHtml } from '../../common/telegram/telegram.service';
import type { AvisoPush } from '../../common/push/push.service';

/**
 * Lo mínimo de un pago que hace falta para redactar un aviso.
 *
 * Es un tipo propio y no el de Prisma a propósito: deja escrito, en un solo
 * lugar, **qué datos salen del sistema hacia Telegram y hacia el teléfono**. Hoy
 * son el nombre del alumno, el servicio y el monto. Ni la cédula, ni el
 * teléfono, ni la ruta del comprobante. Ampliar esto es una decisión, no un
 * descuido.
 */
export interface PagoParaAvisar {
  monto: string;
  cliente: { nombre: string; apellido: string };
  servicio: { nombre: string; cantidadClases: number } | null;
}

/** Los pesos, como se escriben en Uruguay: $ 12.000 */
export function pesos(monto: string): string {
  return `$ ${new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(Number(monto))}`;
}

const nombreDe = (pago: PagoParaAvisar) => `${pago.cliente.nombre} ${pago.cliente.apellido}`;

/**
 * A la academia: llegó un comprobante para revisar.
 *
 * Sin este aviso, la única forma de enterarse es abrir el panel a ver si hay
 * algo esperando, y mientras tanto el alumno espera sin saber nada.
 */
export function avisoDeComprobante(pago: PagoParaAvisar): string {
  return (
    '<b>Comprobante para revisar</b>\n' +
    `Alumno: ${escaparHtml(nombreDe(pago))}\n` +
    `Concepto: ${escaparHtml(pago.servicio?.nombre ?? 'Pago')}\n` +
    `Monto declarado: ${escaparHtml(pesos(pago.monto))}\n\n` +
    'Se revisa desde el panel, en Pagos.'
  );
}

/**
 * Al alumno: le aprobaron el pago.
 *
 * El texto es corto a propósito: una notificación se lee en la pantalla
 * bloqueada, donde la puede ver cualquiera que tenga el teléfono en la mano.
 * Dice que se aprobó y cuántas clases quedaron, que es lo que se necesita saber,
 * y no cuánto pagó.
 */
export function pagoAprobado(servicio: { cantidadClases: number } | null): AvisoPush {
  const clases = servicio?.cantidadClases ?? 0;
  return {
    titulo: 'Pago aprobado',
    cuerpo:
      clases > 0
        ? `Se te acreditaron ${clases} ${clases === 1 ? 'clase' : 'clases'}. Ya podés reservar.`
        : 'La academia confirmó tu pago.',
    url: '/pagar',
  };
}

/** Al alumno: le rechazaron el pago, con el motivo. */
export function pagoRechazado(): AvisoPush {
  return {
    titulo: 'Tu pago necesita una corrección',
    // El motivo NO va acá: puede nombrar el banco o la cuenta de la persona, y
    // esto se ve en la pantalla bloqueada. En la app está entero.
    cuerpo: 'Entrá a la app para ver qué pasó y volver a subirlo.',
    url: '/pagar',
  };
}
