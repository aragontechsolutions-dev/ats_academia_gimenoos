import { useState } from 'react';

import { Boton } from './ui/Boton';
import { Aviso } from './ui/Aviso';
import { miAgenda } from '../lib/recursos';
import type { EstadoReserva, Reserva } from '../lib/tipos';

/** Lo que el motivo de cancelación admite en la API (`CancelarReservaDto`). */
const LARGO_MAXIMO_MOTIVO = 300;

/** Los dos finales de una clase que se dio, con el texto del botón y el de la confirmación. */
const CIERRES = {
  COMPLETADA: {
    boton: 'Dictada',
    pregunta: '¿La clase se dio?',
    confirmar: 'Sí, se dio',
    variante: 'primario',
  },
  AUSENTE: {
    boton: 'Faltó',
    pregunta: '¿El alumno no vino?',
    confirmar: 'Sí, faltó',
    variante: 'peligro',
  },
} as const satisfies Record<
  string,
  { boton: string; pregunta: string; confirmar: string; variante: 'primario' | 'peligro' }
>;

type Cierre = keyof typeof CIERRES;

/**
 * Qué se puede hacer con una clase que todavía está en pie.
 *
 * Tres finales posibles, con distinto peso a propósito:
 *
 * - **Dictada** y **Faltó** son los dos cierres normales y van como botones
 *   grandes, pero sólo aparecen **una vez que la clase empezó**: antes no hay
 *   nada que informar, y marcar «dictada» descuenta una clase del pack del
 *   alumno.
 * - **Cancelar** aparece siempre que la clase siga en pie, porque lo normal es
 *   cancelar *antes* —el instructor se enferma, el auto quedó en el taller—. Va
 *   como acción secundaria y con motivo obligatorio: no es un cierre, es que la
 *   clase no va a pasar, y en el panel alguien va a querer saber por qué.
 *
 * Los tres piden confirmación. Desde el teléfono un botón se toca sin querer, y
 * deshacer cualquiera de los tres requiere a alguien de administración.
 *
 * El cambio lo aplica la API, que además comprueba que la clase sea de este
 * instructor, descuenta del pack dentro de la misma transacción y deja el
 * registro en la auditoría.
 */
export function AccionesDeLaClase({
  reserva,
  yaEmpezo,
  onCambiada,
}: {
  reserva: Reserva;
  /** Si la clase ya empezó. Decide si se puede cerrar o sólo cancelar. */
  yaEmpezo: boolean;
  onCambiada: () => void;
}) {
  const [confirmando, setConfirmando] = useState<Cierre | 'CANCELAR' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function limpiar() {
    setConfirmando(null);
    setMotivo('');
    setError(null);
  }

  async function ejecutar(accion: Cierre | 'CANCELAR') {
    setEnviando(true);
    setError(null);
    try {
      if (accion === 'CANCELAR') await miAgenda.cancelar(reserva.id, motivo.trim());
      else await miAgenda.cambiarEstado(reserva.id, accion as EstadoReserva);
      limpiar();
      onCambiada();
    } catch (problema) {
      // El mensaje viene de la API y dice algo útil: por ejemplo, que el pack
      // del alumno ya no tiene clases disponibles.
      setError((problema as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (confirmando === 'CANCELAR') {
    const sinMotivo = motivo.trim() === '';
    return (
      <div>
        <p className="text-sm font-medium text-slate-900">¿Cancelar esta clase?</p>
        <p className="mt-1 text-xs text-slate-500">
          El horario queda libre y el alumno no pierde la clase del pack.
        </p>

        <label className="mt-3 block text-xs font-medium text-slate-700" htmlFor={`motivo-${reserva.id}`}>
          Por qué se cancela
        </label>
        <input
          id={`motivo-${reserva.id}`}
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value.slice(0, LARGO_MAXIMO_MOTIVO))}
          maxLength={LARGO_MAXIMO_MOTIVO}
          placeholder="El auto quedó en el taller"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 transition focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-200"
        />

        <div className="mt-3 flex gap-2">
          {/* El motivo es obligatorio acá aunque la API lo acepte vacío: quien
              lea esto en el panel mañana necesita saber qué pasó, y el
              instructor es el único que lo sabe en este momento. */}
          <Boton
            variante="peligro"
            className="flex-1"
            disabled={enviando || sinMotivo}
            onClick={() => void ejecutar('CANCELAR')}
          >
            {enviando ? 'Cancelando…' : 'Sí, cancelar'}
          </Boton>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={limpiar}>
            No
          </Boton>
        </div>

        {sinMotivo && <p className="mt-2 text-xs text-slate-500">Escribí el motivo para poder cancelar.</p>}
        {error && (
          <div className="mt-2">
            <Aviso tipo="error">{error}</Aviso>
          </div>
        )}
      </div>
    );
  }

  if (confirmando) {
    const cierre = CIERRES[confirmando];
    return (
      <div>
        <p className="text-sm font-medium text-slate-900">{cierre.pregunta}</p>
        <div className="mt-2 flex gap-2">
          <Boton
            variante={cierre.variante}
            className="flex-1"
            disabled={enviando}
            onClick={() => void ejecutar(confirmando)}
          >
            {enviando ? 'Guardando…' : cierre.confirmar}
          </Boton>
          <Boton variante="secundario" className="flex-1" disabled={enviando} onClick={limpiar}>
            No
          </Boton>
        </div>
        {error && (
          <div className="mt-2">
            <Aviso tipo="error">{error}</Aviso>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {yaEmpezo && (
        <div className="flex gap-2">
          {(Object.keys(CIERRES) as Cierre[]).map((estado) => (
            <Boton
              key={estado}
              variante={CIERRES[estado].variante}
              className="flex-1"
              onClick={() => setConfirmando(estado)}
            >
              {CIERRES[estado].boton}
            </Boton>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setConfirmando('CANCELAR')}
        className={`w-full py-2 text-sm font-medium text-slate-500 underline transition hover:text-slate-700 ${
          yaEmpezo ? 'mt-1' : ''
        }`}
      >
        Cancelar la clase
      </button>
    </div>
  );
}
