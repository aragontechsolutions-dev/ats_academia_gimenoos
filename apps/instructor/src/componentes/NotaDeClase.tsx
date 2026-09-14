import { useState } from 'react';

import { Boton } from './ui/Boton';
import { Aviso } from './ui/Aviso';
import { miAgenda } from '../lib/recursos';
import type { Reserva } from '../lib/tipos';

const LARGO_MAXIMO = 2000;

/**
 * Cómo fue la clase, escrito por el instructor que la dio.
 *
 * **El alumno no la ve.** Eso no lo decide esta pantalla: la API no le manda el
 * campo a un alumno. Acá se dice igual, porque quien escribe tiene que saber
 * para quién está escribiendo.
 *
 * Va en todas las clases, no solo en las que todavía no se cerraron: lo más
 * común es anotar justo después de terminar, y a veces al día siguiente.
 */
export function NotaDeClase({
  reserva,
  onGuardada,
}: {
  reserva: Reserva;
  onGuardada: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(reserva.notaInstructor ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await miAgenda.guardarNota(reserva.id, texto);
      setEditando(false);
      onGuardada();
    } catch (problema) {
      setError((problema as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  if (!editando) {
    return (
      <div>
        {reserva.notaInstructor ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cómo fue
            </p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-amber-50 p-2 text-sm text-amber-950">
              {reserva.notaInstructor}
            </p>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setTexto(reserva.notaInstructor ?? '');
            setEditando(true);
          }}
          className="mt-2 text-sm font-semibold text-marca-600 transition hover:text-marca-700"
        >
          {reserva.notaInstructor ? 'Editar la observación' : 'Anotar cómo fue'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <label
        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
        htmlFor={`nota-${reserva.id}`}
      >
        Cómo fue la clase
      </label>
      <textarea
        id={`nota-${reserva.id}`}
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        maxLength={LARGO_MAXIMO}
        rows={4}
        autoFocus
        placeholder="Qué practicaron, qué le cuesta, qué conviene ver la próxima…"
        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900 transition focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-200"
      />
      <p className="mt-1 text-xs text-slate-500">
        Esto lo ve la academia, no el alumno. Vaciarlo borra la observación.
      </p>

      <div className="mt-2 flex gap-2">
        <Boton className="flex-1" disabled={guardando} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Boton>
        <Boton
          variante="secundario"
          className="flex-1"
          disabled={guardando}
          onClick={() => {
            setEditando(false);
            setError(null);
          }}
        >
          Cancelar
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
