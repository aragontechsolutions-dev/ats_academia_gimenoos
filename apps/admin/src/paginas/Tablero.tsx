import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DateTime } from 'luxon';

import { Aviso } from '../componentes/ui/Aviso';
import { clasesControl } from '../componentes/ui/Campo';
import { tablero as api } from '../lib/recursos';
import { ZONA, fechaCorta } from '../lib/fecha';
import { pesos } from './Pagos';
import { ETIQUETA_CANAL, type ResumenDelTablero } from '../lib/tipos';

/**
 * Los períodos de un clic.
 *
 * «Hoy», «Semana» y «Mes» son los tres cortes que se piden de verdad al abrir
 * el panel. El rango a medida queda para cuando hay que cerrar un mes viejo o
 * mirar una quincena, y por eso no es el que está seleccionado al entrar.
 */
const ATAJOS = [
  { clave: 'hoy', texto: 'Hoy' },
  { clave: 'semana', texto: 'Semana' },
  { clave: 'mes', texto: 'Mes' },
  { clave: 'rango', texto: 'Otro período' },
] as const;

type Atajo = (typeof ATAJOS)[number]['clave'];

/**
 * Traduce un atajo a dos días de calendario.
 *
 * Se calcula en la zona de la academia, igual que en el servidor: si se usara
 * el reloj del navegador, alguien mirando desde España vería «hoy» corrido un
 * día y no entendería por qué le faltan los cobros de la tarde.
 */
function diasDe(atajo: Atajo): { desde: string; hasta: string } {
  const hoy = DateTime.now().setZone(ZONA).startOf('day');
  const dia = (fecha: DateTime) => fecha.toISODate()!;

  if (atajo === 'hoy') return { desde: dia(hoy), hasta: dia(hoy) };
  // La semana arranca el lunes: es como se cuenta la semana de trabajo acá.
  if (atajo === 'semana') return { desde: dia(hoy.startOf('week')), hasta: dia(hoy) };
  return { desde: dia(hoy.startOf('month')), hasta: dia(hoy) };
}

/** Una cifra grande con su rótulo. Es la unidad de la que está hecha la pantalla. */
function Cifra({
  rotulo,
  valor,
  detalle,
  acento,
  a,
}: {
  rotulo: string;
  valor: string;
  detalle?: string;
  acento?: 'atencion' | 'bien';
  a?: string;
}) {
  const color =
    acento === 'atencion'
      ? 'border-amber-300 bg-amber-50'
      : acento === 'bien'
        ? 'border-green-200 bg-green-50'
        : 'border-slate-200 bg-white';

  const contenido = (
    <>
      <p className="text-xs uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-slate-500">{detalle}</p>}
    </>
  );

  const clases = `block rounded-xl border p-4 ${color}`;
  // Las tarjetas que llevan a algún lado son enlaces de verdad, no divs con
  // onClick: así se abren en otra pestaña con el botón del medio y el teclado
  // las alcanza sin que haya que agregarle nada.
  return a ? (
    <Link to={a} className={`${clases} transition hover:border-slate-400`}>
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

/**
 * El gráfico de barras del período.
 *
 * Es SVG escrito a mano y no una librería: son dos series y un eje, y sumar
 * una dependencia de gráficos al panel por esto cuesta más de lo que resuelve.
 */
function Barras({ dias }: { dias: ResumenDelTablero['dias'] }) {
  const maximo = Math.max(...dias.map((d) => Number(d.cobrado)), 1);
  // Con más de dos meses las etiquetas se pisan: se muestran salteadas.
  const cada = dias.length > 45 ? 7 : dias.length > 14 ? 3 : 1;

  return (
    <div className="flex items-end gap-1" role="img" aria-label="Cobrado por día">
      {dias.map((dia, indice) => {
        const monto = Number(dia.cobrado);
        const alto = (monto / maximo) * 100;
        return (
          <div key={dia.dia} className="flex flex-1 flex-col items-center gap-1">
            {/* La altura de esta caja es explícita a propósito: un porcentaje
                solo se resuelve contra un alto definido, y con `flex-1` acá las
                barras quedaban en cero y el gráfico salía en blanco. */}
            <div
              className="flex h-32 w-full items-end"
              title={`${fechaCorta(dia.dia)}: ${pesos(dia.cobrado)} · ${dia.clases} ${
                dia.clases === 1 ? 'clase' : 'clases'
              }`}
            >
              <div
                className={`w-full rounded-t ${monto > 0 ? 'bg-marca-500' : 'bg-slate-200'}`}
                /* Un día sin cobros deja igual una línea fina: marca la base y
                   da dónde apoyar el dedo para ver que ese día fue cero. */
                style={{ height: monto > 0 ? `${Math.max(alto, 2)}%` : '2px' }}
                data-dia={dia.dia}
              />
            </div>
            <span className="h-3 text-[10px] leading-3 text-slate-400">
              {indice % cada === 0 ? dia.dia.slice(8) : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Una tabla chica de dos columnas, para los desgloses. */
function Desglose({
  titulo,
  vacio,
  filas,
}: {
  titulo: string;
  vacio: string;
  filas: { texto: string; valor: string }[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-900">{titulo}</h2>
      {filas.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{vacio}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {filas.map((fila) => (
            <li key={fila.texto} className="flex items-baseline justify-between gap-3">
              <span className="text-slate-600">{fila.texto}</span>
              <span className="font-medium text-slate-900">{fila.valor}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * La pantalla de inicio del panel.
 *
 * Contesta, sin que haya que buscar nada, las tres preguntas con las que se
 * abre el panel a la mañana: cuánta plata entró, qué quedó sin revisar y
 * cuántas clases se dieron.
 *
 * Hay un criterio de fechas que conviene tener presente y que la pantalla dice
 * en voz alta más abajo: un pago cuenta en el día en que se hizo, no en el día
 * en que se aprobó. Los pendientes, en cambio, se muestran siempre completos:
 * son trabajo por hacer, y esconderlos porque son de otro mes sería justamente
 * lo contrario de para qué está el tablero.
 */
export function Tablero() {
  const [atajo, setAtajo] = useState<Atajo>('mes');
  const [rango, setRango] = useState(() => diasDe('mes'));
  const [datos, setDatos] = useState<ResumenDelTablero | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const elegir = (nuevo: Atajo) => {
    setAtajo(nuevo);
    if (nuevo !== 'rango') setRango(diasDe(nuevo));
  };

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    api
      .resumen(rango)
      .then(setDatos)
      .catch((problema: unknown) => {
        setError(problema instanceof Error ? problema.message : 'No se pudo cargar el resumen');
        setDatos(null);
      })
      .finally(() => setCargando(false));
  }, [rango]);

  useEffect(cargar, [cargar]);

  const porCanal = useMemo(
    () =>
      (datos?.cobrado.porCanal ?? [])
        .map((fila) => ({
          texto: `${ETIQUETA_CANAL[fila.canal]} (${fila.cantidad})`,
          valor: pesos(fila.monto),
        }))
        .sort((a, b) => a.texto.localeCompare(b.texto, 'es')),
    [datos],
  );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resumen</h1>
          <p className="mt-1 text-sm text-slate-500">
            {datos
              ? `Del ${fechaCorta(datos.periodo.desde)} al ${fechaCorta(datos.periodo.hasta)}`
              : 'Cargando…'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {ATAJOS.map((opcion) => (
            <button
              key={opcion.clave}
              type="button"
              onClick={() => elegir(opcion.clave)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                atajo === opcion.clave
                  ? 'border-marca-600 bg-marca-600 text-white'
                  : 'border-slate-300 text-slate-700 hover:border-slate-400'
              }`}
            >
              {opcion.texto}
            </button>
          ))}
        </div>
      </header>

      {atajo === 'rango' && (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <label className="text-sm">
            <span className="block text-slate-600">Desde</span>
            <input
              type="date"
              value={rango.desde}
              max={rango.hasta}
              onChange={(evento) => setRango((r) => ({ ...r, desde: evento.target.value }))}
              className={clasesControl}
            />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600">Hasta</span>
            <input
              type="date"
              value={rango.hasta}
              min={rango.desde}
              onChange={(evento) => setRango((r) => ({ ...r, hasta: evento.target.value }))}
              className={clasesControl}
            />
          </label>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}
      {cargando && !datos && <p className="mt-6 text-slate-500">Cargando…</p>}

      {datos && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cifra
              rotulo="Cobrado"
              valor={pesos(datos.cobrado.total)}
              detalle={`${datos.cobrado.cantidad} ${datos.cobrado.cantidad === 1 ? 'pago' : 'pagos'}`}
              acento="bien"
            />
            <Cifra
              rotulo="Para revisar"
              valor={String(datos.pendientes.cantidad)}
              detalle={
                datos.pendientes.desdeCuando
                  ? `El más viejo, del ${fechaCorta(datos.pendientes.desdeCuando)}`
                  : 'Nada pendiente'
              }
              acento={datos.pendientes.cantidad > 0 ? 'atencion' : undefined}
              a="/pagos"
            />
            <Cifra
              rotulo="Clases dictadas"
              valor={String(datos.clases.dictadas)}
              detalle={`${datos.clases.agendadas} agendadas por delante`}
              a="/agenda"
            />
            <Cifra
              rotulo="Alumnos nuevos"
              valor={String(datos.alumnosNuevos)}
              detalle={`${datos.clases.sinUsar} clases compradas sin dar`}
              a="/alumnos"
            />
          </div>

          {/* Este renglón no es decorativo: sin él, quien cierre la caja del
              viernes no tiene cómo saber por qué un pago aprobado el lunes no
              figura en el total del viernes. */}
          <p className="mt-3 text-xs text-slate-500">
            Los montos se cuentan por la fecha en que se hizo el pago, no por la fecha en que se
            aprobó. Los pagos para revisar se muestran todos, sin importar el período.
          </p>

          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-900">Día a día</h2>
            <p className="text-xs text-slate-500">
              Cobrado por día. Pasá el dedo o el mouse por una barra para ver el detalle.
            </p>
            <div className="mt-4">
              <Barras dias={datos.dias} />
            </div>
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Desglose
              titulo="Por forma de pago"
              vacio="No hubo cobros en este período."
              filas={porCanal}
            />
            <Desglose
              titulo="Por servicio"
              vacio="No hubo cobros en este período."
              filas={datos.porServicio.map((fila) => ({
                texto: `${fila.servicio} (${fila.cantidad})`,
                valor: pesos(fila.monto),
              }))}
            />
            <Desglose
              titulo="Clases por instructor"
              vacio="No se dictaron clases en este período."
              filas={datos.porInstructor.map((fila) => ({
                texto: fila.instructor,
                valor: String(fila.clases),
              }))}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Cifra rotulo="Canceladas" valor={String(datos.clases.canceladas)} />
            <Cifra rotulo="Ausentes" valor={String(datos.clases.ausentes)} />
            <Cifra rotulo="Pagos rechazados" valor={String(datos.rechazados)} />
            <Cifra
              rotulo="Pendiente de cobro"
              valor={pesos(datos.pendientes.monto)}
              detalle="Comprobantes sin aprobar"
            />
          </div>
        </>
      )}
    </>
  );
}
