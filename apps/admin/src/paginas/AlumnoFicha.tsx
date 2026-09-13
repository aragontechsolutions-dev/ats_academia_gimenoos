import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { Aviso } from '../componentes/ui/Aviso';
import { Boton } from '../componentes/ui/Boton';
import { FormularioAlumno } from './Alumnos';
import { clientes as api, invitaciones as apiInvitaciones } from '../lib/recursos';
import { documentoLegible } from '../lib/paises';
import { fechaCorta, fechaYHora } from '../lib/fecha';
import { useSesion } from '../lib/sesion';
import { abrirWhatsApp, mensajeDeAcceso, numeroParaWhatsApp } from '../lib/whatsapp';
import { ETIQUETA_ESTADO, type FichaCliente, type Invitacion } from '../lib/tipos';

export function AlumnoFicha() {
  const { id } = useParams<{ id: string }>();
  const { hash } = useLocation();
  const { perfil } = useSesion();
  const esAdmin = perfil?.rol === 'ADMIN';

  const [ficha, setFicha] = useState<FichaCliente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  const cargar = useCallback(() => {
    if (!id) return;
    void api
      .obtener(id)
      .then(setFicha)
      .catch((problema: Error) => setError(problema.message));
  }, [id]);

  useEffect(cargar, [cargar]);

  // Al llegar desde "Dar acceso" en el listado, bajar hasta esa sección.
  //
  // No alcanza con el ancla en la dirección: la sección se pinta recién cuando
  // llega la ficha, y para entonces el navegador ya decidió que no hay adónde ir.
  useEffect(() => {
    if (!ficha || hash !== '#acceso') return;
    document.getElementById('acceso')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [ficha, hash]);

  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!ficha) return <p className="text-slate-500">Cargando…</p>;

  const dictadas = ficha.reservas.filter((r) => r.estado === 'COMPLETADA').length;
  const proximas = ficha.reservas.filter(
    (r) => new Date(r.inicio) > new Date() && (r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA'),
  );

  return (
    <>
      <Link to="/alumnos" className="text-sm text-marca-600 hover:underline">
        ← Volver a alumnos
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {ficha.nombre} {ficha.apellido}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {[ficha.telefono, ficha.email, ficha.ciudad].filter(Boolean).join(' · ')}
          </p>
        </div>
        {esAdmin && <Boton variante="secundario" onClick={() => setEditando(true)}>Editar ficha</Boton>}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Tarjeta titulo="Clases dictadas" valor={String(dictadas)} />
        <Tarjeta titulo="Próximas clases" valor={String(proximas.length)} />
        <Tarjeta
          titulo="Clases disponibles en packs"
          valor={String(
            ficha.compras.reduce((total, c) => total + (c.clasesTotales - c.clasesUsadas), 0),
          )}
        />
      </div>

      {esAdmin && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Datos personales</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <Dato
              etiqueta={ficha.tipoDocumento === 'PASAPORTE' ? 'Pasaporte' : 'Cédula'}
              valor={documentoLegible(ficha)}
            />
            <Dato
              etiqueta="Fecha de nacimiento"
              valor={ficha.fechaNacimiento ? fechaCorta(ficha.fechaNacimiento) : null}
            />
            <Dato etiqueta="Dirección" valor={ficha.direccion} />
            <Dato etiqueta="Cuenta en el sistema" valor={ficha.usuarioId ? 'Sí' : 'No'} />
          </dl>
          {ficha.notasInternas && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <strong className="block text-xs uppercase tracking-wide">Notas internas</strong>
              {ficha.notasInternas}
            </div>
          )}
        </section>
      )}

      {esAdmin && <AccesoALaApp ficha={ficha} onCambio={cargar} />}

      {ficha.compras.length > 0 && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Packs comprados</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {ficha.compras.map((compra) => (
              <li key={compra.id} className="flex items-center justify-between gap-4">
                <span className="text-slate-700">{compra.servicio.nombre}</span>
                <span className="text-slate-500">
                  {compra.clasesUsadas} de {compra.clasesTotales} usadas
                  {compra.vigenteHasta && ` · vence ${fechaCorta(compra.vigenteHasta)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-semibold text-slate-900">Historial de clases</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Instructor</th>
                <th className="px-4 py-3 font-medium">Vehículo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ficha.reservas.map((reserva) => (
                <tr key={reserva.id}>
                  <td className="px-4 py-3 text-slate-700">{fechaYHora(reserva.inicio)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {reserva.instructor.nombre} {reserva.instructor.apellido}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {reserva.vehiculo?.patente ?? '—'} · {reserva.tipo.toLowerCase()}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{ETIQUETA_ESTADO[reserva.estado]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ficha.reservas.length === 0 && (
            <p className="p-6 text-center text-slate-500">Todavía no tomó ninguna clase.</p>
          )}
        </div>
      </section>

      {editando && (
        <FormularioAlumno
          alumno={ficha}
          onCerrar={() => setEditando(false)}
          onGuardado={cargar}
        />
      )}
    </>
  );
}

function Tarjeta({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{valor}</p>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-slate-500">{etiqueta}</dt>
      <dd className="text-slate-900">{valor || '—'}</dd>
    </div>
  );
}

/**
 * Acceso del alumno a su app.
 *
 * La cuenta NO se crea sola cuando el alumno escribe su correo en la app: la
 * habilita la academia desde acá. Así el sistema sabe de antemano a qué ficha
 * pertenece la cuenta, en vez de deducirlo por el correo después del hecho, que
 * fallaba cuando había dos fichas iguales o el alumno usaba otra dirección.
 *
 * Dos formas de entregarlo, porque la gente llega por dos caminos distintos:
 *
 *   - **Por correo**, que lo manda Supabase. Sirve cuando la persona ya dejó su
 *     dirección y la mira.
 *   - **Por WhatsApp**, que es por donde llega casi todo el mundo desde el sitio.
 *     El enlace se genera acá y se abre WhatsApp con el mensaje listo; el envío
 *     lo aprieta quien atiende. La cuenta igual se identifica por el correo:
 *     WhatsApp es por dónde viaja el enlace, no quién es la persona.
 */
function AccesoALaApp({ ficha, onCambio }: { ficha: FichaCliente; onCambio: () => void }) {
  const [lista, setLista] = useState<Invitacion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(() => {
    void apiInvitaciones
      .deCliente(ficha.id)
      .then(setLista)
      .catch(() => setLista([]));
  }, [ficha.id]);

  useEffect(cargar, [cargar]);

  const pendiente = lista.find((i) => i.estado === 'PENDIENTE');
  const whatsapp = numeroParaWhatsApp(ficha.telefono);

  const accion = async (promesa: Promise<unknown>, exito: string) => {
    setTrabajando(true);
    setError(null);
    setAviso(null);
    try {
      await promesa;
      setAviso(exito);
      cargar();
      onCambio();
    } catch (problema) {
      setError((problema as Error).message);
    } finally {
      setTrabajando(false);
    }
  };

  /**
   * Genera el enlace y abre WhatsApp con el mensaje listo.
   *
   * Se pide confirmación mostrando el número: mandarle el acceso de alguien a
   * otra persona le entrega su cuenta, y el número es lo único que separa un
   * caso del otro.
   *
   * El enlace se usa y se descarta: no se guarda en ningún estado ni se muestra
   * en pantalla, porque quien lo tenga entra como esa persona.
   */
  const enviarPorWhatsApp = async (invitacionId?: string) => {
    if (!whatsapp) return;
    if (
      !window.confirm(
        `Se va a abrir WhatsApp para mandarle el acceso a ${ficha.nombre} al ${ficha.telefono}.\n\n` +
          'Revisá que el número sea el correcto: quien reciba el enlace entra como esta persona.',
      )
    ) {
      return;
    }

    setTrabajando(true);
    setError(null);
    setAviso(null);
    try {
      const invitacion = invitacionId
        ? await apiInvitaciones.reenviar(invitacionId, 'ENLACE')
        : await apiInvitaciones.crear({ rol: 'CLIENTE', clienteId: ficha.id, canal: 'ENLACE' });

      if (!invitacion.enlace) throw new Error('El servidor no devolvió el enlace.');

      abrirWhatsApp(ficha.telefono ?? '', mensajeDeAcceso(ficha.nombre, invitacion.enlace));
      setAviso('Se abrió WhatsApp con el mensaje listo. Falta que lo envíes desde ahí.');
      cargar();
      onCambio();
    } catch (problema) {
      setError((problema as Error).message);
    } finally {
      setTrabajando(false);
    }
  };

  const ayudaWhatsApp = !ficha.telefono
    ? 'Le falta el teléfono en la ficha.'
    : !whatsapp
      ? 'El teléfono de la ficha no tiene una forma que WhatsApp entienda.'
      : null;

  return (
    <section id="acceso" className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Acceso a la app</h2>

      {ficha.usuarioId ? (
        <p className="mt-2 text-sm text-slate-600">
          Ya tiene cuenta y entra con su correo. Para sacarle el acceso hay que desactivar
          la cuenta, desde Cuentas.
        </p>
      ) : (
        <>
          {pendiente ? (
            <p className="mt-2 text-sm text-slate-600">
              Acceso entregado a <strong>{pendiente.email}</strong>
              {pendiente.enviadaAt ? (
                <>
                  {pendiente.canal === 'ENLACE' ? ' por WhatsApp' : ' por correo'} el{' '}
                  {fechaYHora(pendiente.enviadaAt)}. Todavía no entró.
                </>
              ) : (
                <>
                  , pero <strong className="text-amber-800">no llegó a salir</strong>. Probá de
                  nuevo.
                </>
              )}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Todavía no tiene acceso. Al habilitarlo recibe un enlace para entrar a ver y
              reservar sus clases.
            </p>
          )}

          {!ficha.email && (
            <p className="mt-2 text-sm text-amber-800">
              Le falta el correo en la ficha, y hace falta para crear la cuenta: es con lo que
              el sistema la identifica, aunque el enlace se lo mandes por WhatsApp.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Boton
              disabled={trabajando || !ficha.email || !whatsapp}
              onClick={() => void enviarPorWhatsApp(pendiente?.id)}
            >
              {trabajando ? 'Preparando…' : 'Enviar enlace por WhatsApp'}
            </Boton>
            <Boton
              variante="secundario"
              disabled={trabajando || !ficha.email}
              onClick={() =>
                void accion(
                  pendiente
                    ? apiInvitaciones.reenviar(pendiente.id, 'CORREO')
                    : apiInvitaciones.crear({ rol: 'CLIENTE', clienteId: ficha.id, canal: 'CORREO' }),
                  'Listo, le mandamos el enlace por correo.',
                )
              }
            >
              Enviar por correo
            </Boton>
            {pendiente && (
              <Boton
                variante="peligro"
                disabled={trabajando}
                onClick={() => {
                  if (window.confirm('¿Dar de baja el acceso? El enlace que mandaste deja de servir.')) {
                    void accion(apiInvitaciones.revocar(pendiente.id), 'Acceso dado de baja.');
                  }
                }}
              >
                Dar de baja
              </Boton>
            )}
          </div>

          {ayudaWhatsApp && ficha.email && (
            <p className="mt-2 text-xs text-slate-500">
              {ayudaWhatsApp} Por eso no se puede mandar por WhatsApp.
            </p>
          )}

          <p className="mt-3 text-xs text-slate-500">
            El enlace vence en 24 horas y se usa una sola vez. Si se vence, mandá otro desde acá.
          </p>
        </>
      )}

      {error && <div className="mt-3"><Aviso tipo="error">{error}</Aviso></div>}
      {aviso && <div className="mt-3"><Aviso tipo="exito">{aviso}</Aviso></div>}
    </section>
  );
}
