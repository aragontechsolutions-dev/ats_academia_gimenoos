import { useState } from 'react';

import { Boton } from './ui/Boton';
import { Aviso } from './ui/Aviso';
import { miAgenda } from '../lib/recursos';
import type { EstadoReserva, Reserva } from '../lib/tipos';

/** Los dos finales posibles de una clase, con el texto del botón y el de la confirmación. */
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
} as const satisfies Record<string, { boton: string; pregunta: string; confirmar: string; variante: 'primario' | 'peligro' }>;

type Cierre = keyof typeof CIERRES;

/**
 * Cierra una clase: dictada, o el alumno faltó.
 *
 * Pide confirmación antes de mandar, y no por costumbre: marcarla como dictada
 * **descuenta una clase del pack del alumno**, y desde el teléfono un botón se
 * toca sin querer. Deshacerlo requiere a alguien de administración.
 *
 * El cambio lo aplica la API, que además comprueba que la clase sea de este
 * instructor y descuenta la clase dentro de la misma transacción.
 */
export function CerrarClase({ reserva, onCerrada }: { reserva: Reserva; onCerrada: () => void }) {
  const [confirmando, setConfirmando] = useState<Cierre | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cerrar(estado: Cierre) {
    setEnviando(true);
    setError(null);
    try {
      await miAgenda.cambiarEstado(reserva.id, estado as EstadoReserva);
      setConfirmando(null);
      onCerrada();
    } catch (problema) {
      // El mensaje viene de la API y dice algo útil: por ejemplo, que el pack
      // del alumno ya no tiene clases disponibles.
      setError((problema as Error).message);
    } finally {
      setEnviando(false);
    }
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
            onClick={() => void cerrar(confirmando)}
          >
            {enviando ? 'Guardando…' : cierre.confirmar}
          </Boton>
          <Boton
            variante="secundario"
            className="flex-1"
            disabled={enviando}
            onClick={() => {
              setConfirmando(null);
              setError(null);
            }}
          >
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
  );
}
