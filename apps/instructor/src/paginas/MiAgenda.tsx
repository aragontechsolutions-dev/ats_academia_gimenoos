import { useCallback, useEffect, useState } from 'react';
import { DateTime } from 'luxon';

import { SelectorDeVista } from '../componentes/SelectorDeVista';
import { VistaDia } from '../componentes/agenda/VistaDia';
import { VistaSemana } from '../componentes/agenda/VistaSemana';
import { VistaMes } from '../componentes/agenda/VistaMes';
import { Aviso } from '../componentes/ui/Aviso';
import { miAgenda } from '../lib/recursos';
import { useSesion } from '../lib/sesion';
import { ZONA } from '../lib/fecha';
import { paso, queEmpiezanEn, rangoDe, subtituloDe, tituloDe, type Vista } from '../lib/agenda';
import { ESTADOS_VIGENTES, type Reserva } from '../lib/tipos';

/**
 * La agenda del instructor: día, semana o mes.
 *
 * El día es la vista de trabajo y por eso es la que abre: esta app se usa parado
 * al lado del auto, con una mano, para saber quién viene ahora. La semana y el
 * mes son para ubicarse —cuándo tengo lugar, cómo viene la semana— y no repiten
 * las acciones: tocar un día en cualquiera de las dos lleva al día.
 *
 * La API acota el resultado a la agenda de quien está autenticado: acá no se
 * manda ningún identificador de instructor, y si se mandara lo ignoraría.
 */
export function MiAgenda() {
  const { perfil } = useSesion();
  const [vista, setVista] = useState<Vista>('dia');
  // Anotado como `DateTime` a secas: luxon distingue en los tipos una fecha
  // válida de una inválida, y los días que llegan desde la grilla del mes son
  // del tipo general. Sin la anotación, el estado queda fijado al tipo "válida"
  // y no acepta esos días.
  const [referencia, setReferencia] = useState<DateTime>(() =>
    DateTime.now().setZone(ZONA).startOf('day'),
  );
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hoy = DateTime.now().setZone(ZONA).startOf('day');

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    const { desde, hasta } = rangoDe(vista, referencia);
    void miAgenda
      .listar(desde.toJSDate(), hasta.toJSDate())
      // La API devuelve también la clase que viene de la noche anterior, porque
      // filtra por solapamiento. Acá interesan las que empiezan en el período.
      .then((datos) => setReservas(queEmpiezanEn(datos, desde, hasta)))
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargando(false));
  }, [vista, referencia]);

  useEffect(cargar, [cargar]);

  /**
   * Una clase se cierra recién cuando empezó.
   *
   * Antes de la hora no hay nada que informar: no se sabe si se dio ni si el
   * alumno vino. Y marcarla como dictada descuenta una clase del pack, así que
   * un botón de más en la pantalla es un error caro. Cancelar sí está siempre,
   * porque lo normal es cancelar antes.
   *
   * Se calcula en cada dibujado. Con la app abierta y quieta no aparece solo al
   * dar la hora, pero cualquier cambio de día o recarga lo actualiza, y esta es
   * una pantalla que se mira y se cierra.
   */
  const yaEmpezo = (reserva: Reserva) => new Date(reserva.inicio) <= new Date();

  /** Ir a un día desde la semana o el mes cambia las dos cosas a la vez. */
  const abrirDia = (dia: DateTime) => {
    setReferencia(dia.startOf('day'));
    setVista('dia');
  };

  const enPie = reservas.filter((r) => ESTADOS_VIGENTES.includes(r.estado)).length;
  const subtitulo = subtituloDe(vista, referencia);
  const esPeriodoActual = referencia.hasSame(hoy, vista === 'dia' ? 'day' : vista === 'semana' ? 'week' : 'month');

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Hola{perfil?.nombre ? `, ${perfil.nombre}` : ''}
        </h1>
        {/* El resumen se calcula sobre lo que ya está cargado, así que mientras
            carga no se muestra un número viejo. */}
        <p className="mt-1 text-sm text-slate-500">
          {cargando
            ? 'Buscando tus clases…'
            : reservas.length === 0
              ? 'Sin clases en este período'
              : `${reservas.length} ${reservas.length === 1 ? 'clase' : 'clases'} · ${enPie} en pie`}
        </p>
      </header>

      <div className="mt-4">
        <SelectorDeVista vista={vista} onCambiar={setVista} />
      </div>

      <nav
        className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2"
        aria-label="Período de la agenda"
      >
        <BotonDePeriodo
          etiqueta="Período anterior"
          simbolo="‹"
          onClick={() => setReferencia((actual) => actual.minus(paso(vista)))}
        />
        <div className="min-w-0 text-center">
          <p className="truncate font-semibold text-slate-900">{tituloDe(vista, referencia, hoy)}</p>
          {subtitulo && <p className="text-xs tabular-nums text-slate-500">{subtitulo}</p>}
        </div>
        <BotonDePeriodo
          etiqueta="Período siguiente"
          simbolo="›"
          onClick={() => setReferencia((actual) => actual.plus(paso(vista)))}
        />
      </nav>

      {!esPeriodoActual && (
        <button
          type="button"
          onClick={() => setReferencia(hoy)}
          className="mt-2 w-full text-sm font-medium text-marca-600 transition hover:text-marca-700"
        >
          Volver a hoy
        </button>
      )}

      {error && (
        <div className="mt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      {cargando && <p className="mt-6 text-slate-500">Cargando…</p>}

      {!cargando && !error && (
        <div className="mt-4">
          {vista === 'dia' && (
            <>
              {reservas.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-600">
                  No tenés clases {tituloDe('dia', referencia, hoy).toLowerCase()}.
                </p>
              ) : (
                <VistaDia reservas={reservas} yaEmpezo={yaEmpezo} onCambiada={cargar} />
              )}
            </>
          )}

          {vista === 'semana' && (
            <VistaSemana reservas={reservas} hoy={hoy} onElegirDia={abrirDia} />
          )}

          {vista === 'mes' && (
            <VistaMes reservas={reservas} referencia={referencia} onElegirDia={abrirDia} />
          )}
        </div>
      )}
    </>
  );
}

/** Las dos flechas de la barra, con un blanco cómodo para el pulgar. */
function BotonDePeriodo({
  etiqueta,
  simbolo,
  onClick,
}: {
  etiqueta: string;
  simbolo: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl text-slate-600 transition hover:bg-slate-100"
    >
      <span aria-hidden="true">{simbolo}</span>
      <span className="sr-only">{etiqueta}</span>
    </button>
  );
}
