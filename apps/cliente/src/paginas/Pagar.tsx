import { useCallback, useEffect, useRef, useState } from 'react';

import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { academia, misPagos, servicios as apiServicios } from '../lib/recursos';
import { ACEPTA_INPUT, subirComprobante } from '../lib/comprobantes';
import { fechaCorta } from '../lib/fecha';
import { useAvisos } from '../lib/avisos';
import { useSesion } from '../lib/sesion';
import { ETIQUETA_PAGO, type ConfiguracionPublica, type MiPago, type ServicioPublico } from '../lib/tipos';

/** Dónde se recuerda el servicio elegido mientras se busca el comprobante. */
const RECUERDO = 'gimenoos:pago-elegido';

function recordado(): string {
  try {
    return sessionStorage.getItem(RECUERDO) ?? '';
  } catch {
    return '';
  }
}

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

  /**
   * Qué servicio eligió, recordado entre recargas.
   *
   * No es un lujo. En el teléfono, abrir la galería o la cámara para elegir el
   * comprobante deja a la app en segundo plano, y Android la puede cerrar para
   * liberar memoria. Al volver, la app arranca de cero y lo elegido se perdió:
   * la persona ve la pantalla en blanco otra vez y cree que algo falló. Con esto
   * vuelve a donde estaba.
   */
  const [elegido, setElegido] = useState<string>(() => recordado());

  /**
   * A qué pago va el archivo que se está por elegir.
   *
   * `nuevo` crea el pago en el momento; `existente` completa uno que quedó sin
   * comprobante. Sin esto, el mismo botón de archivo no podría servir para las
   * dos cosas.
   */
  const [destino, setDestino] = useState<{ tipo: 'nuevo' } | { tipo: 'existente'; pagoId: string }>(
    { tipo: 'nuevo' },
  );
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

  // Se guarda en `sessionStorage` y no en `localStorage`: es el estado de algo
  // que se está haciendo ahora, no una preferencia que deba sobrevivir a cerrar
  // la app.
  useEffect(() => {
    try {
      if (elegido) sessionStorage.setItem(RECUERDO, elegido);
      else sessionStorage.removeItem(RECUERDO);
    } catch {
      // Navegación privada o almacenamiento bloqueado. Se pierde el recuerdo y
      // nada más: la pantalla funciona igual.
    }
  }, [elegido]);

  const cargar = useCallback(() => {
    void misPagos.listar().then(setMios).catch(() => setMios([]));
  }, []);

  useEffect(() => {
    void apiServicios.listar().then(setServicios).catch(() => setServicios([]));
    void academia.configuracion().then(setConfig).catch(() => setConfig(null));
    cargar();
  }, [cargar]);

  /** Abre el selector de archivos apuntando a dónde va el comprobante. */
  function elegirArchivo(hacia: { tipo: 'nuevo' } | { tipo: 'existente'; pagoId: string }) {
    setDestino(hacia);
    entrada.current?.click();
  }

  /**
   * Sube el comprobante, sea de un pago nuevo o de uno que quedó a medias.
   *
   * El pago se crea ANTES de subir el archivo porque la carpeta donde vive el
   * archivo lleva su identificador. La consecuencia buena es que, si la subida
   * falla, el pago queda en «Falta el comprobante» **con un botón para
   * completarlo** en el historial de abajo: no se pierde nada y no hay que
   * empezar de cero. Eso último faltaba, y era lo que convertía cualquier
   * tropiezo en «se borró todo».
   */
  async function subir(archivo: File) {
    if (!perfil) return;
    setSubiendo(true);
    try {
      const pagoId =
        destino.tipo === 'existente'
          ? destino.pagoId
          : elegido
            ? (await misPagos.empezar(elegido)).id
            : null;
      if (!pagoId) return;

      const { archivo: nombre, seAchico } = await subirComprobante(perfil.id, pagoId, archivo);
      await misPagos.registrarComprobante(pagoId, nombre);

      avisos.exito(
        seAchico
          ? 'Comprobante enviado. La imagen se redujo para que entrara; si no se llega a leer, mandanos el PDF.'
          : 'Comprobante enviado. La academia lo va a revisar.',
      );
      setElegido('');
      setDestino({ tipo: 'nuevo' });
      cargar();
    } catch (problema) {
      avisos.error(problema);
      // A propósito NO se limpia lo elegido: si falló, la persona va a querer
      // reintentar con otro archivo sin volver a elegir el servicio.
      cargar();
    } finally {
      setSubiendo(false);
      // Se limpia el input para que elegir DOS VECES el mismo archivo vuelva a
      // disparar el evento: sin esto, un reintento con el mismo archivo no hace
      // nada y parece que la app se colgó.
      if (entrada.current) entrada.current.value = '';
    }
  }

  const activos = (servicios ?? []).filter((s) => Number(s.precioContado) > 0);
  const ULTIMOS = 5;
  // Un pago sin comprobante SIEMPRE se ve, aunque sea viejo: es lo único de
  // esta lista sobre lo que hay algo que hacer, y esconderlo detrás de «ver los
  // anteriores» es esconder justo lo que hace falta.
  const visibles = verTodos
    ? (mios ?? [])
    : (mios ?? []).filter((pago, indice) => indice < ULTIMOS || pago.estado === 'PENDIENTE');
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
            if (archivo) void subir(archivo);
          }}
        />
        <Boton
          className="mt-3 w-full"
          disabled={!elegido || subiendo}
          onClick={() => elegirArchivo({ tipo: 'nuevo' })}
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

                {/* El camino de vuelta. Un pago sin comprobante —porque la
                    subida falló, porque el teléfono cerró la app mientras se
                    buscaba la foto, o porque se cambió de idea a mitad— se
                    completa desde acá en vez de empezar de cero. */}
                {pago.estado === 'PENDIENTE' && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-600">
                      Este pago quedó sin comprobante. Subilo y la academia lo revisa.
                    </p>
                    <Boton
                      className="mt-2 w-full"
                      variante="secundario"
                      disabled={subiendo}
                      onClick={() => elegirArchivo({ tipo: 'existente', pagoId: pago.id })}
                    >
                      {subiendo ? 'Enviando…' : 'Subir el comprobante'}
                    </Boton>
                  </div>
                )}

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
