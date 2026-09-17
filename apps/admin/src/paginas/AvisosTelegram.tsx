import { useCallback, useEffect, useState } from 'react';

import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { avisosTelegram as api, type ChatDeTelegram, type EstadoAvisosTelegram } from '../lib/recursos';
import { fechaYHora } from '../lib/fecha';
import { useAvisos } from '../lib/avisos';

/**
 * Los interruptores, con el texto que explica cuándo llega cada aviso.
 *
 * Están en una tabla y no escritos a mano en el formulario para que agregar un
 * aviso nuevo sea agregar un renglón acá.
 */
const INTERRUPTORES = [
  {
    clave: 'avisaReservaNueva',
    titulo: 'Clase agendada',
    detalle: 'Cuando un alumno reserva desde su app, o cuando se agenda desde el panel.',
  },
  {
    clave: 'avisaClaseCerrada',
    titulo: 'Clase cerrada',
    detalle: 'Cuando el instructor la marca como dictada, o marca que el alumno no vino.',
  },
  {
    clave: 'avisaClaseCancelada',
    titulo: 'Clase cancelada',
    detalle: 'La cancele quien la cancele: el alumno, el instructor o la academia.',
  },
  {
    clave: 'avisaRecordatorios',
    titulo: 'Recordatorio de clase',
    detalle:
      'El día antes y dos horas antes de cada clase, con el teléfono del alumno a mano por si hay que llamarlo.',
  },
  {
    clave: 'avisaClicWhatsapp',
    titulo: 'Alguien va a escribir por WhatsApp',
    detalle:
      'Cuando alguien toca un botón de WhatsApp en el sitio. El aviso dice desde qué sección salió. Es el que más puede sonar, porque depende de cuánta gente visite la página.',
  },
] as const satisfies ReadonlyArray<{
  clave: keyof EstadoAvisosTelegram;
  titulo: string;
  detalle: string;
}>;

export function AvisosTelegram() {
  const avisos = useAvisos();
  const [estado, setEstado] = useState<EstadoAvisosTelegram | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatDeTelegram[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(() => {
    void api
      .estado()
      .then(setEstado)
      .catch((problema: Error) => setError(problema.message));
  }, []);

  useEffect(cargar, [cargar]);

  /**
   * Guarda un cambio, moviendo la pantalla ANTES de que conteste el servidor.
   *
   * Una casilla que se queda quieta hasta que vuelve la respuesta se lee como
   * que el clic no entró, y la reacción natural es volver a apretarla. Se mueve
   * en el acto y, si el guardado falla, se vuelve atrás: el aviso de error
   * explica por qué, y la pantalla vuelve a decir la verdad.
   */
  async function guardar(cambios: Partial<EstadoAvisosTelegram>, hecho: string) {
    const previo = estado;
    setEstado((actual) => (actual ? { ...actual, ...cambios } : actual));
    setTrabajando(true);
    try {
      setEstado(await api.guardar(cambios));
      avisos.exito(hecho);
    } catch (problema) {
      setEstado(previo);
      avisos.error(problema);
    } finally {
      setTrabajando(false);
    }
  }

  async function buscarChats() {
    setBuscando(true);
    try {
      const encontrados = await api.chats();
      setChats(encontrados);
      if (encontrados.length === 0) {
        avisos.error(
          new Error(
            'El bot no recibió ningún mensaje en las últimas 24 horas. Escribile /start desde Telegram y volvé a buscar.',
          ),
        );
      }
    } catch (problema) {
      avisos.error(problema);
    } finally {
      setBuscando(false);
    }
  }

  async function probar() {
    setTrabajando(true);
    try {
      await api.probar();
      avisos.exito('Mensaje de prueba enviado. Miralo en Telegram.');
      cargar();
    } catch (problema) {
      avisos.error(problema);
    } finally {
      setTrabajando(false);
    }
  }

  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!estado) return <p className="text-slate-500">Cargando…</p>;

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Avisos por Telegram</h1>
        <p className="mt-1 text-sm text-slate-600">
          Para enterarte al instante de lo que pasa en la academia, sin tener que entrar al panel
          a mirar.
        </p>
      </div>

      {!estado.botConfigurado && (
        <div className="mt-5">
          <Aviso tipo="error">
            <strong className="font-semibold">Falta el bot.</strong> El token del bot se carga en
            el servidor, no acá: es una credencial y no tiene que pasar por esta pantalla ni
            quedar guardada en la base. Mirá <code>docs/23-avisos-telegram.md</code> para los
            cuatro pasos.
          </Aviso>
        </div>
      )}

      {/* --- A quién se le avisa --- */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">A quién le llegan</h2>

        {estado.chatId ? (
          <p className="mt-2 text-sm text-slate-700">
            Los avisos van a{' '}
            <strong className="font-semibold text-slate-900">
              {estado.chatNombre ?? `la conversación ${estado.chatId}`}
            </strong>
            .
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Todavía no elegiste a dónde. Sin esto no sale ningún aviso.
          </p>
        )}

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Antes de buscar</p>
          {/* Este paso no se puede automatizar y confunde a todo el mundo: un bot
              de Telegram no puede escribirle primero a nadie. La conversación la
              tiene que empezar la persona. */}
          <p className="mt-1">
            Abrí Telegram, buscá tu bot y mandale <code className="font-mono">/start</code>. Si
            querés que los avisos lleguen a un grupo, agregá el bot al grupo y escribí cualquier
            cosa ahí. Recién después tocá «Buscar conversaciones»: Telegram sólo cuenta lo de las
            últimas 24 horas.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Boton variante="secundario" disabled={buscando || !estado.botConfigurado} onClick={() => void buscarChats()}>
            {buscando ? 'Buscando…' : 'Buscar conversaciones'}
          </Boton>
          {estado.chatId && (
            <Boton variante="secundario" disabled={trabajando} onClick={() => void probar()}>
              Mandar un mensaje de prueba
            </Boton>
          )}
        </div>

        {chats && chats.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {chats.map((chat) => {
              const elegido = chat.id === estado.chatId;
              return (
                <li key={chat.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm">
                    <span className="font-medium text-slate-900">{chat.nombre}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {chat.tipo === 'grupo' ? 'Grupo' : 'Conversación privada'}
                    </span>
                  </span>
                  {elegido ? (
                    <span className="text-xs font-semibold text-green-700">Elegida</span>
                  ) : (
                    <button
                      type="button"
                      disabled={trabajando}
                      onClick={() =>
                        void guardar(
                          { chatId: chat.id, chatNombre: chat.nombre },
                          `Los avisos van a ir a ${chat.nombre}`,
                        )
                      }
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:border-marca-500 hover:text-marca-700"
                    >
                      Usar esta
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* --- Qué se avisa --- */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">Qué se avisa</h2>
        <p className="mt-1 text-sm text-slate-600">
          Cada uno se prende y se apaga por separado. Apagar acá corta el aviso en el momento, sin
          tocar nada del servidor.
        </p>

        <ul className="mt-4 space-y-3">
          {INTERRUPTORES.map((interruptor) => (
            <li key={interruptor.clave}>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={Boolean(estado[interruptor.clave])}
                  disabled={trabajando}
                  onChange={(evento) =>
                    void guardar(
                      { [interruptor.clave]: evento.target.checked },
                      evento.target.checked
                        ? `Se va a avisar: ${interruptor.titulo.toLowerCase()}`
                        : `Ya no se avisa: ${interruptor.titulo.toLowerCase()}`,
                    )
                  }
                  className="mt-0.5 h-4 w-4"
                />
                <span className="text-sm">
                  <span className="font-medium text-slate-900">{interruptor.titulo}</span>
                  <span className="mt-0.5 block text-xs text-slate-600">{interruptor.detalle}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {/* --- Si anda o no --- */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">Si está andando</h2>
        {/* Sin esto, un bot bloqueado o un grupo borrado se ven igual que "hoy no
            pasó nada". */}
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Último aviso que salió bien</dt>
            <dd className="text-slate-900">
              {estado.ultimoEnvioAt ? fechaYHora(estado.ultimoEnvioAt) : 'Todavía ninguno'}
            </dd>
          </div>
          {estado.ultimoError && (
            <div>
              <dt className="text-slate-500">
                Último fallo{estado.ultimoErrorAt && ` · ${fechaYHora(estado.ultimoErrorAt)}`}
              </dt>
              <dd className="mt-1 rounded-lg bg-red-50 p-2 text-red-900">{estado.ultimoError}</dd>
            </div>
          )}
        </dl>
      </section>
    </>
  );
}
