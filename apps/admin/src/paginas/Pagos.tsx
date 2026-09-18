import { useCallback, useEffect, useState } from 'react';

import { Modal } from '../componentes/ui/Modal';
import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { Campo, clasesControl } from '../componentes/ui/Campo';
import { Paginacion, PAGINA_VACIA, type Pagina } from '../componentes/ui/Paginacion';
import { BuscadorDeAlumno } from '../componentes/BuscadorDeAlumno';
import { pagos as api, servicios as apiServicios } from '../lib/recursos';
import { fechaYHora } from '../lib/fecha';
import { documentoLegible } from '../lib/paises';
import { useAvisos } from '../lib/avisos';
import {
  ETIQUETA_CANAL,
  ETIQUETA_ESTADO_PAGO,
  type Cliente,
  type EstadoPago,
  type Pago,
  type Servicio,
} from '../lib/tipos';

/** Los pesos, como se escriben en Uruguay. */
export const pesos = (monto: string | number): string =>
  `$ ${new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(Number(monto))}`;

const COLOR_ESTADO: Record<EstadoPago, string> = {
  PENDIENTE: 'bg-slate-100 text-slate-700',
  PENDIENTE_VERIFICACION: 'bg-amber-100 text-amber-900',
  APROBADO: 'bg-green-100 text-green-800',
  RECHAZADO: 'bg-red-100 text-red-800',
  REEMBOLSADO: 'bg-slate-100 text-slate-600',
};

/** Los filtros del listado. «Para revisar» va primero: es a lo que se entra. */
const FILTROS: Array<{ valor: EstadoPago | ''; texto: string }> = [
  { valor: 'PENDIENTE_VERIFICACION', texto: 'Para revisar' },
  { valor: '', texto: 'Todos' },
  { valor: 'APROBADO', texto: 'Aprobados' },
  { valor: 'RECHAZADO', texto: 'Rechazados' },
  { valor: 'PENDIENTE', texto: 'Sin comprobante' },
];

export function Pagos() {
  const avisos = useAvisos();
  const [pagina, setPagina] = useState<Pagina<Pago>>(PAGINA_VACIA as Pagina<Pago>);
  const [consulta, setConsulta] = useState({ pagina: 1, porPagina: 10 });
  const [estado, setEstado] = useState<EstadoPago | ''>('PENDIENTE_VERIFICACION');
  const [busqueda, setBusqueda] = useState('');
  /**
   * Lo que de verdad se le pide a la API.
   *
   * Va aparte de `busqueda` porque se actualiza con espera: sin eso, escribir
   * «Rodríguez» dispara nueve consultas y la lista parpadea con resultados de
   * búsquedas que ya no son la actual.
   */
  const [busquedaAplicada, setBusquedaAplicada] = useState('');

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revisando, setRevisando] = useState<Pago | null>(null);
  const [registrando, setRegistrando] = useState(false);

  // Buscador en tiempo real, con 300 ms de espera.
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusquedaAplicada(busqueda.trim());
      // Devolver el MISMO objeto cuando ya se está en la página 1 no es un
      // detalle: un objeto nuevo cambia la identidad de `cargar` y el listado
      // se vuelve a pedir. Sin esto, abrir la pantalla disparaba dos consultas
      // idénticas y el «Cargando…» parpadeaba dos veces.
      setConsulta((actual) => (actual.pagina === 1 ? actual : { ...actual, pagina: 1 }));
    }, 300);
    return () => clearTimeout(temporizador);
  }, [busqueda]);

  const cargar = useCallback(() => {
    setCargando(true);
    void api
      .listar({ ...consulta, ...(estado ? { estado } : {}), ...(busquedaAplicada ? { q: busquedaAplicada } : {}) })
      .then(setPagina)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargando(false));
  }, [consulta, estado, busquedaAplicada]);

  useEffect(cargar, [cargar]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pagos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Los comprobantes que suben los alumnos y los cobros hechos en el mostrador.
          </p>
        </div>
        <Boton onClick={() => setRegistrando(true)}>Registrar pago en efectivo</Boton>
      </div>

      {error && (
        <div className="mt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block flex-1 min-w-64">
          <span className="text-xs font-medium text-slate-500">Buscar alumno</span>
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Nombre, apellido, cédula o pasaporte"
            className={clasesControl}
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-500">Estado</span>
          <select
            value={estado}
            onChange={(evento) => {
              setEstado(evento.target.value as EstadoPago | '');
              setConsulta((actual) => ({ ...actual, pagina: 1 }));
            }}
            className={`${clasesControl} w-48`}
          >
            {FILTROS.map((filtro) => (
              <option key={filtro.valor} value={filtro.valor}>
                {filtro.texto}
              </option>
            ))}
          </select>
        </label>
      </div>

      {cargando && <p className="mt-4 text-slate-500">Cargando…</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Alumno</th>
              <th className="px-4 py-3 font-medium">Documento</th>
              <th className="px-4 py-3 font-medium">Concepto</th>
              <th className="px-4 py-3 font-medium">Monto</th>
              <th className="px-4 py-3 font-medium">Forma</th>
              <th className="px-4 py-3 font-medium">Cuándo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagina.datos.map((pago) => (
              <tr key={pago.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {pago.cliente.nombre} {pago.cliente.apellido}
                </td>
                <td className="px-4 py-3 text-slate-600">{documentoLegible(pago.cliente)}</td>
                <td className="px-4 py-3 text-slate-600">{pago.servicio?.nombre ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{pesos(pago.monto)}</td>
                <td className="px-4 py-3 text-slate-600">{ETIQUETA_CANAL[pago.canal]}</td>
                <td className="px-4 py-3 text-slate-500">{fechaYHora(pago.createdAt)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${COLOR_ESTADO[pago.estado]}`}
                  >
                    {ETIQUETA_ESTADO_PAGO[pago.estado]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setRevisando(pago)}
                    className="text-marca-600 hover:underline"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!cargando && pagina.datos.length === 0 && (
          <p className="p-6 text-center text-slate-500">
            {busquedaAplicada
              ? 'Ningún pago coincide con la búsqueda.'
              : 'No hay pagos con ese estado.'}
          </p>
        )}
      </div>

      <Paginacion
        pagina={pagina}
        etiqueta="pagos"
        onCambio={(cambios) => setConsulta((actual) => ({ ...actual, ...cambios }))}
      />

      {revisando && (
        <DetallePago
          pago={revisando}
          onCerrar={() => setRevisando(null)}
          onCambio={() => {
            setRevisando(null);
            cargar();
          }}
        />
      )}

      {registrando && (
        <PagoEnEfectivo
          onCerrar={() => setRegistrando(false)}
          onGuardado={() => {
            setRegistrando(false);
            avisos.exito('Pago en efectivo registrado');
            cargar();
          }}
        />
      )}
    </>
  );
}

/** Revisar un pago: ver el comprobante, aprobarlo o rechazarlo. */
function DetallePago({
  pago,
  onCerrar,
  onCambio,
}: {
  pago: Pago;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const avisos = useAvisos();
  const [trabajando, setTrabajando] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  // Arranca con el monto del pago: lo normal es aprobar lo que ya dice.
  const [monto, setMonto] = useState(String(Math.round(Number(pago.monto))));

  const revisable = pago.estado === 'PENDIENTE' || pago.estado === 'PENDIENTE_VERIFICACION';
  const corregido = Number(monto) !== Math.round(Number(pago.monto));

  async function verComprobante() {
    setTrabajando(true);
    try {
      const { url } = await api.verComprobante(pago.id);
      // Se abre y se descarta: la dirección dura cinco minutos y no se guarda.
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (problema) {
      avisos.error(problema);
    } finally {
      setTrabajando(false);
    }
  }

  async function aprobar() {
    setTrabajando(true);
    try {
      await api.aprobar(pago.id, corregido ? { monto: Number(monto) } : {});
      avisos.exito(
        `Pago aprobado${pago.servicio ? `: ${pago.servicio.cantidadClases} clases acreditadas` : ''}`,
      );
      onCambio();
    } catch (problema) {
      avisos.error(problema);
      setTrabajando(false);
    }
  }

  async function rechazar() {
    setTrabajando(true);
    try {
      await api.rechazar(pago.id, motivo);
      avisos.exito('Pago rechazado. El alumno ve el motivo.');
      onCambio();
    } catch (problema) {
      avisos.error(problema);
      setTrabajando(false);
    }
  }

  return (
    <Modal titulo="Pago" onCerrar={onCerrar}>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Alumno</dt>
          <dd className="text-right font-medium text-slate-900">
            {pago.cliente.nombre} {pago.cliente.apellido}
            {pago.cliente.telefono && (
              <span className="block text-xs font-normal text-slate-500">
                {pago.cliente.telefono}
              </span>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Concepto</dt>
          <dd className="text-right text-slate-900">
            {pago.servicio?.nombre ?? '—'}
            {pago.servicio && (
              <span className="block text-xs text-slate-500">
                {pago.servicio.cantidadClases}{' '}
                {pago.servicio.cantidadClases === 1 ? 'clase' : 'clases'}
              </span>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Monto declarado</dt>
          <dd className="font-medium text-slate-900">{pesos(pago.monto)}</dd>
        </div>
        {pago.montoEsperado && Number(pago.montoEsperado) !== Number(pago.monto) && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Precio de lista</dt>
            <dd className="text-slate-500">{pesos(pago.montoEsperado)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Forma</dt>
          <dd className="text-slate-900">{ETIQUETA_CANAL[pago.canal]}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Estado</dt>
          <dd className="font-medium text-slate-900">{ETIQUETA_ESTADO_PAGO[pago.estado]}</dd>
        </div>
        {pago.verificadoAt && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Revisado</dt>
            <dd className="text-slate-600">{fechaYHora(pago.verificadoAt)}</dd>
          </div>
        )}
        {pago.motivoRechazo && (
          <div>
            <dt className="text-slate-500">Motivo del rechazo</dt>
            <dd className="mt-1 rounded-lg bg-red-50 p-2 text-red-900">{pago.motivoRechazo}</dd>
          </div>
        )}
        {pago.nota && (
          <div>
            <dt className="text-slate-500">Nota interna</dt>
            <dd className="mt-1 text-slate-700">{pago.nota}</dd>
          </div>
        )}
      </dl>

      {pago.comprobantePath ? (
        <Boton variante="secundario" className="mt-4 w-full" disabled={trabajando} onClick={() => void verComprobante()}>
          Ver el comprobante
        </Boton>
      ) : (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          El alumno todavía no subió el comprobante.
        </p>
      )}

      {revisable && !rechazando && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <Campo
            etiqueta="Monto a acreditar"
            ayuda="Cambialo si el banco dice otra cosa. Queda registrado quién lo corrigió."
          >
            <input
              type="number"
              inputMode="numeric"
              value={monto}
              onChange={(evento) => setMonto(evento.target.value)}
              className={clasesControl}
            />
          </Campo>

          <div className="mt-4 flex flex-wrap gap-2">
            <Boton disabled={trabajando || !monto || Number(monto) <= 0} onClick={() => void aprobar()}>
              {trabajando ? 'Aprobando…' : 'Aprobar'}
            </Boton>
            <Boton variante="peligro" disabled={trabajando} onClick={() => setRechazando(true)} className="ml-auto">
              Rechazar
            </Boton>
          </div>
        </div>
      )}

      {rechazando && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <Campo etiqueta="Por qué se rechaza" requerido ayuda="El alumno lo va a leer.">
            <input
              type="text"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="El comprobante es de otra cuenta"
              className={clasesControl}
            />
          </Campo>
          <div className="mt-3 flex gap-2">
            <Boton variante="peligro" disabled={trabajando || !motivo.trim()} onClick={() => void rechazar()}>
              {trabajando ? 'Rechazando…' : 'Sí, rechazar'}
            </Boton>
            <Boton variante="secundario" onClick={() => setRechazando(false)}>
              Volver
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Registrar un cobro hecho en el mostrador. */
function PagoEnEfectivo({
  onCerrar,
  onGuardado,
}: {
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const avisos = useAvisos();
  const [lista, setLista] = useState<Servicio[]>([]);
  const [alumno, setAlumno] = useState<Cliente | null>(null);
  const [servicioId, setServicioId] = useState('');
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    // Desplegable: necesita la lista completa, no una página.
    void apiServicios.listar().then(setLista).catch(() => setLista([]));
  }, []);

  const elegido = lista.find((s) => s.id === servicioId);

  async function guardar() {
    if (!alumno || !servicioId) return;
    setGuardando(true);
    try {
      await api.registrarEfectivo({
        clienteId: alumno.id,
        servicioId,
        ...(monto ? { monto: Number(monto) } : {}),
        ...(nota ? { nota } : {}),
      });
      onGuardado();
    } catch (problema) {
      avisos.error(problema);
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Pago en efectivo" onCerrar={onCerrar} ancho="max-w-xl">
      <div className="space-y-4">
        <Campo etiqueta="Alumno" requerido>
          <BuscadorDeAlumno valor={alumno} onElegir={setAlumno} autoFoco />
        </Campo>

        <Campo etiqueta="Qué pagó" requerido>
          <select
            value={servicioId}
            onChange={(evento) => setServicioId(evento.target.value)}
            className={clasesControl}
          >
            <option value="">Elegí un servicio</option>
            {lista.map((servicio) => (
              <option key={servicio.id} value={servicio.id}>
                {servicio.nombre} — {pesos(servicio.precioContado)}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          etiqueta="Monto cobrado"
          ayuda={
            elegido
              ? `Vacío usa el precio de lista: ${pesos(elegido.precioContado)}`
              : 'Vacío usa el precio de lista'
          }
        >
          <input
            type="number"
            inputMode="numeric"
            value={monto}
            onChange={(evento) => setMonto(evento.target.value)}
            placeholder={elegido ? String(Math.round(Number(elegido.precioContado))) : ''}
            className={clasesControl}
          />
        </Campo>

        <Campo etiqueta="Nota interna" ayuda="No la ve el alumno">
          <input
            type="text"
            value={nota}
            onChange={(evento) => setNota(evento.target.value)}
            className={clasesControl}
          />
        </Campo>

        {elegido && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Al guardar se le acreditan <strong>{elegido.cantidadClases}</strong>{' '}
            {elegido.cantidadClases === 1 ? 'clase' : 'clases'}
            {alumno && <> a {alumno.nombre}</>}.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton disabled={!alumno || !servicioId || guardando} onClick={() => void guardar()}>
            {guardando ? 'Guardando…' : 'Registrar pago'}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
