import { useCallback, useEffect, useRef, useState } from 'react';

import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { academia, misPagos, servicios as apiServicios } from '../lib/recursos';
import { ACEPTA_INPUT, subirComprobante } from '../lib/comprobantes';
import { fechaCorta } from '../lib/fecha';
import { useAvisos } from '../lib/avisos';
import { useSesion } from '../lib/sesion';
import { ETIQUETA_PAGO, type ConfiguracionPublica, type MiPago, type ServicioPublico } from '../lib/tipos';

/** Los pesos, como se escriben en Uruguay: $ 12.000 */
const pesos = (monto: string): string =>
  `$ ${new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(Number(monto))}`;

/** Colores de cada estado. El rechazado tiene que saltar a la vista. */
const COLOR: Record<string, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-900',
  PENDIENTE_VERIFICACION: 'bg-sky-50 text-sky-900',
  APROBADO: 'bg-green-50 text-green-800',
  RECHAZADO: 'bg-red-50 text-red-800',
  REEMBOLSADO: 'bg-slate-100 text-slate-700',
};

/**
 * Pagar una clase o un pack.
 *
 * Hoy solo por transferencia, y la pantalla lo dice de entrada en vez de dejar
 * que el alumno busque una opción que no existe.
 *
 * El flujo es en dos pasos, y eso no es un capricho: primero se crea el pago
 * —que es lo que le da un identificador y fija el monto **en el servidor**— y
 * recién después se sube el archivo a una carpeta que lleva ese identificador.
 * Al revés no se puede: no habría dónde guardarlo.
 */
export function Pagar() {
  const avisos = useAvisos();
  const { perfil } = useSesion();

  const [servicios, setServicios] = useState<ServicioPublico[] | null>(null);
  const [config, setConfig] = useState<ConfiguracionPublica | null>(null);
  const [mios, setMios] = useState<MiPago[] | null>(null);

  const [elegido, setElegido] = useState<string>('');
  /**
   * El historial arranca recortado.
   *
   * Un alumno con un año de clases junta decenas de pagos, y desplegarlos todos
   * convierte la pantalla en un rollo de varios metros donde lo único que
   * importa —si ya le revisaron el último— queda enterrado arriba.
   */
  const [verTodos, setVerTodos] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const cargar = useCallback(() => {
    void misPagos.listar().then(setMios).catch(() => setMios([]));
  }, []);

  useEffect(() => {
    void apiServicios.listar().then(setServicios).catch(() => setServicios([]));
    void academia.configuracion().then(setConfig).catch(() => setConfig(null));
    cargar();
  }, [cargar]);

  /**
   * Crea el pago y sube el comprobante, en ese orden.
   *
   * Si la subida falla, el pago queda en «Falta el comprobante»: se ve en el
   * listado de abajo y el alumno puede volver a intentarlo sin empezar de cero.
   */
  async function pagar(archivo: File) {
    if (!elegido || !perfil) return;
    setSubiendo(true);
    try {
      const pago = await misPagos.empezar(elegido);
      const { archivo: nombre } = await subirComprobante(perfil.id, pago.id, archivo);
      await misPagos.registrarComprobante(pago.id, nombre);

      avisos.exito('Comprobante enviado. La academia lo va a revisar.');
      setElegido('');
      cargar();
    } catch (problema) {
      avisos.error(problema);
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  const activos = (servicios ?? []).filter((s) => Number(s.precioContado) > 0);
  const ULTIMOS = 5;
  const visibles = verTodos ? (mios ?? []) : (mios ?? []).slice(0, ULTIMOS);
  const ocultos = (mios?.length ?? 0) - visibles.length;

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Pagar</h1>
        <p className="mt-1 text-sm text-slate-500">
          Por ahora solo por transferencia bancaria.
        </p>
      </header>

      {/* Los datos para transferir. Sin esto la pantalla no sirve: el alumno no
          sabría a dónde mandar la plata. */}
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">1. Hacé la transferencia</h2>
        <p className="mt-2 text-sm text-slate-600">
          Pedile los datos de la cuenta a la academia
          {config?.whatsapp && <> por WhatsApp al {config.whatsapp}</>}. Cuando la tengas hecha,
          volvé acá y subí el comprobante.
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">2. Elegí qué pagaste</h2>

        {servicios === null ? (
          <p className="mt-2 text-sm text-slate-500">Cargando…</p>
        ) : activos.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            La academia todavía no publicó los precios. Escribinos y lo arreglamos.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {activos.map((servicio) => (
              <label
                key={servicio.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  elegido === servicio.id
                    ? 'border-marca-600 bg-marca-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="servicio"
                  checked={elegido === servicio.id}
                  onChange={() => setElegido(servicio.id)}
                  className="mt-1 h-4 w-4"
                />
                <span className="flex-1 text-sm">
                  <span className="block font-medium text-slate-900">{servicio.nombre}</span>
                  {servicio.cantidadClases > 1 && (
                    <span className="block text-xs text-slate-500">
                      {servicio.cantidadClases} clases
                    </span>
                  )}
                </span>
                <span className="font-semibold text-slate-900">
                  {pesos(servicio.precioContado)}
                </span>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">3. Subí el comprobante</h2>
        <p className="mt-1 text-xs text-slate-500">
          El que te da el banco: puede ser el PDF o una captura. Hasta 5 MB.
        </p>

        <input
          ref={entrada}
          type="file"
          accept={ACEPTA_INPUT}
          className="hidden"
          onChange={(evento) => {
            const archivo = evento.target.files?.[0];
            if (archivo) void pagar(archivo);
          }}
        />
        <Boton
          className="mt-3 w-full"
          disabled={!elegido || subiendo}
          onClick={() => entrada.current?.click()}
        >
          {subiendo ? 'Enviando…' : 'Elegir el comprobante'}
        </Boton>
        {!elegido && (
          <p className="mt-2 text-center text-xs text-slate-500">
            Primero elegí qué pagaste, arriba.
          </p>
        )}
      </section>

      {/* El historial. Es lo que contesta «¿ya lo revisaron?» sin tener que
          escribirle a nadie. */}
      {mios !== null && mios.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-slate-900">Tus pagos</h2>
          <div className="mt-3 space-y-3">
            {visibles.map((pago) => (
              <article key={pago.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {pago.servicio?.nombre ?? 'Pago'}
                    </p>
                    <p className="text-xs text-slate-500">{fechaCorta(pago.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{pesos(pago.monto)}</p>
                    <span
                      className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        COLOR[pago.estado] ?? 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {ETIQUETA_PAGO[pago.estado]}
                    </span>
                  </div>
                </div>

                {pago.estado === 'RECHAZADO' && pago.motivoRechazo && (
                  <div className="mt-3">
                    <Aviso tipo="error">{pago.motivoRechazo}</Aviso>
                  </div>
                )}
                {pago.estado === 'APROBADO' && pago.servicio && pago.servicio.cantidadClases > 0 && (
                  <p className="mt-2 text-xs text-green-800">
                    Se te acreditaron {pago.servicio.cantidadClases}{' '}
                    {pago.servicio.cantidadClases === 1 ? 'clase' : 'clases'}.
                  </p>
                )}
              </article>
            ))}
          </div>

          {ocultos > 0 && (
            <button
              type="button"
              onClick={() => setVerTodos(true)}
              className="mt-3 w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
            >
              Ver los {ocultos} anteriores
            </button>
          )}
        </section>
      )}
    </>
  );
}
