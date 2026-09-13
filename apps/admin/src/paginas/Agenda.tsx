import { useCallback, useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';

import { GrillaHoraria, type ColumnaAgenda } from '../componentes/agenda/GrillaHoraria';
import { VistaMes } from '../componentes/agenda/VistaMes';
import { DetalleReserva } from '../componentes/agenda/DetalleReserva';
import { NuevaClase } from '../componentes/agenda/NuevaClase';
import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { agenda, instructores as apiInstructores, vehiculos as apiVehiculos } from '../lib/recursos';
import { aLocal, soloPrimeraMayuscula } from '../lib/fecha';
import type { Instructor, Reserva, Vehiculo } from '../lib/tipos';

type Vista = 'dia' | 'semana' | 'mes';

const TITULO_VISTA: Record<Vista, string> = { dia: 'Día', semana: 'Semana', mes: 'Mes' };

/** Rango que se consulta a la API según la vista. */
function rango(vista: Vista, referencia: DateTime): { desde: DateTime; hasta: DateTime } {
  if (vista === 'dia') return { desde: referencia.startOf('day'), hasta: referencia.endOf('day') };
  if (vista === 'semana') return { desde: referencia.startOf('week'), hasta: referencia.endOf('week') };
  // El mes se pide con las semanas completas que se dibujan en la grilla.
  return {
    desde: referencia.startOf('month').startOf('week'),
    hasta: referencia.endOf('month').endOf('week'),
  };
}

export function Agenda() {
  const [vista, setVista] = useState<Vista>('semana');
  const [referencia, setReferencia] = useState<DateTime>(() => DateTime.now());
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [listaInstructores, setListaInstructores] = useState<Instructor[]>([]);
  const [listaVehiculos, setListaVehiculos] = useState<Vehiculo[]>([]);

  const [filtroInstructor, setFiltroInstructor] = useState('');
  const [filtroVehiculo, setFiltroVehiculo] = useState('');

  const [seleccionada, setSeleccionada] = useState<Reserva | null>(null);
  const [agendando, setAgendando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Son desplegables de filtro: necesitan la lista completa, no una página.
    // Con el paginado por defecto mostrarían solo 10 y nadie se daría cuenta de
    // que faltan instructores en el filtro.
    void Promise.all([
      apiInstructores.listar({ porPagina: 100 }),
      apiVehiculos.listar({ porPagina: 100 }),
    ])
      .then(([i, v]) => {
        setListaInstructores(i.datos);
        setListaVehiculos(v.datos);
      })
      .catch((problema: Error) => setError(problema.message));
  }, []);

  const cargar = useCallback(() => {
    const { desde, hasta } = rango(vista, referencia);
    setCargando(true);
    void agenda
      .reservas({
        desde: desde.toJSDate(),
        hasta: hasta.toJSDate(),
        instructorId: filtroInstructor || undefined,
        vehiculoId: filtroVehiculo || undefined,
      })
      .then(setReservas)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargando(false));
  }, [vista, referencia, filtroInstructor, filtroVehiculo]);

  useEffect(cargar, [cargar]);

  const columnas = useMemo<ColumnaAgenda[]>(() => {
    if (vista === 'dia') {
      // Un instructor por columna: es como se lee la jornada en el mostrador.
      const visibles = filtroInstructor
        ? listaInstructores.filter((i) => i.id === filtroInstructor)
        : listaInstructores;

      return visibles.map((instructor) => ({
        id: instructor.id,
        titulo: `${instructor.nombre} ${instructor.apellido}`,
        subtitulo: [instructor.habilitaAuto && 'auto', instructor.habilitaMoto && 'moto']
          .filter(Boolean)
          .join(' · '),
        color: instructor.colorAgenda,
        reservas: reservas.filter((r) => r.instructor.id === instructor.id),
      }));
    }

    if (vista === 'semana') {
      const inicio = referencia.startOf('week');
      return Array.from({ length: 7 }, (_, i) => {
        const dia = inicio.plus({ days: i });
        return {
          id: dia.toISODate() ?? String(i),
          titulo: dia.toFormat('ccc d'),
          subtitulo: dia.hasSame(DateTime.now(), 'day') ? 'hoy' : undefined,
          reservas: reservas.filter((r) => aLocal(r.inicio).hasSame(dia, 'day')),
        };
      });
    }

    return [];
  }, [vista, referencia, reservas, listaInstructores, filtroInstructor]);

  const mover = (direccion: 1 | -1) => {
    const unidad = vista === 'dia' ? 'days' : vista === 'semana' ? 'weeks' : 'months';
    setReferencia((actual) => actual.plus({ [unidad]: direccion }));
  };

  const titulo = (() => {
    const texto =
      vista === 'mes'
        ? referencia.toFormat('LLLL yyyy')
        : vista === 'semana'
          ? `${referencia.startOf('week').toFormat('d LLL')} – ${referencia.endOf('week').toFormat('d LLL yyyy')}`
          : referencia.toFormat("cccc d 'de' LLLL yyyy");
    return soloPrimeraMayuscula(texto);
  })();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        <Boton onClick={() => setAgendando(true)}>Agendar clase</Boton>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-300">
          <button
            type="button"
            onClick={() => mover(-1)}
            className="px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setReferencia(DateTime.now())}
            className="border-x border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => mover(1)}
            className="px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Siguiente"
          >
            ›
          </button>
        </div>

        <div className="flex rounded-lg border border-slate-300">
          {(Object.keys(TITULO_VISTA) as Vista[]).map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => setVista(opcion)}
              className={`px-3 py-1.5 text-sm ${
                vista === opcion ? 'bg-marca-600 font-semibold text-white' : 'text-slate-700 hover:bg-slate-100'
              } ${opcion === 'dia' ? 'rounded-l-lg' : ''} ${opcion === 'mes' ? 'rounded-r-lg' : ''}`}
            >
              {TITULO_VISTA[opcion]}
            </button>
          ))}
        </div>

        <select
          value={filtroInstructor}
          onChange={(evento) => setFiltroInstructor(evento.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todos los instructores</option>
          {listaInstructores.map((instructor) => (
            <option key={instructor.id} value={instructor.id}>
              {instructor.nombre} {instructor.apellido}
            </option>
          ))}
        </select>

        <select
          value={filtroVehiculo}
          onChange={(evento) => setFiltroVehiculo(evento.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todos los vehículos</option>
          {listaVehiculos.map((vehiculo) => (
            <option key={vehiculo.id} value={vehiculo.id}>
              {vehiculo.patente} ({vehiculo.tipo.toLowerCase()})
            </option>
          ))}
        </select>

        {cargando && <span className="text-sm text-slate-500">Cargando…</span>}
      </div>

      {error && (
        <div className="mt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      <div className="mt-4">
        {vista === 'mes' ? (
          <VistaMes
            mes={referencia}
            reservas={reservas}
            alSeleccionar={setSeleccionada}
            alElegirDia={(dia) => {
              setReferencia(dia);
              setVista('dia');
            }}
          />
        ) : (
          <GrillaHoraria columnas={columnas} alSeleccionar={setSeleccionada} />
        )}
      </div>

      {!cargando && reservas.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">No hay clases agendadas en este período.</p>
      )}

      {seleccionada && (
        <DetalleReserva
          reserva={seleccionada}
          onCerrar={() => setSeleccionada(null)}
          onCambio={cargar}
        />
      )}

      {agendando && (
        <NuevaClase
          instructores={listaInstructores}
          diaInicial={referencia}
          onCerrar={() => setAgendando(false)}
          onCreada={cargar}
        />
      )}
    </>
  );
}
