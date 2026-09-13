import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Aviso } from '../componentes/ui/Aviso';
import { Boton } from '../componentes/ui/Boton';
import { FormularioAlumno } from './Alumnos';
import { clientes as api, invitaciones as apiInvitaciones } from '../lib/recursos';
import { documentoLegible } from '../lib/paises';
import { fechaCorta, fechaYHora } from '../lib/fecha';
import { useSesion } from '../lib/sesion';
import { ETIQUETA_ESTADO, type FichaCliente, type Invitacion } from '../lib/tipos';

export function AlumnoFicha() {
  const { id } = useParams<{ id: string }>();
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

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Acceso a la app</h2>

      {ficha.usuarioId ? (
        <p className="mt-2 text-sm text-slate-600">
          Ya tiene cuenta y entra con su correo. Para sacarle el acceso hay que desactivar
          la cuenta.
        </p>
      ) : pendiente ? (
        <>
          <p className="mt-2 text-sm text-slate-600">
            Invitación enviada a <strong>{pendiente.email}</strong>
            {pendiente.enviadaAt ? (
              <> el {fechaYHora(pendiente.enviadaAt)}. Todavía no la usó.</>
            ) : (
              <>
                , pero <strong className="text-amber-800">el correo no salió</strong>. Probá
                reenviarla.
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton
              variante="secundario"
              disabled={trabajando}
              onClick={() =>
                void accion(apiInvitaciones.reenviar(pendiente.id), 'Listo, se reenvió el correo.')
              }
            >
              Reenviar invitación
            </Boton>
            <Boton
              variante="peligro"
              disabled={trabajando}
              onClick={() => {
                if (window.confirm('¿Dar de baja la invitación? El enlace deja de servir.')) {
                  void accion(apiInvitaciones.revocar(pendiente.id), 'Invitación dada de baja.');
                }
              }}
            >
              Dar de baja
            </Boton>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600">
            Todavía no tiene acceso. Al invitarlo le llega un correo con un enlace para entrar
            a ver y reservar sus clases.
          </p>
          {!ficha.email && (
            <p className="mt-2 text-sm text-amber-800">
              Le falta el correo en la ficha. Cargalo antes de invitarlo.
            </p>
          )}
          <Boton
            className="mt-3"
            disabled={trabajando || !ficha.email}
            onClick={() =>
              void accion(
                apiInvitaciones.crear({ rol: 'CLIENTE', clienteId: ficha.id }),
                'Listo, le mandamos la invitación por correo.',
              )
            }
          >
            {trabajando ? 'Enviando…' : 'Invitar a la app'}
          </Boton>
        </>
      )}

      {error && <div className="mt-3"><Aviso tipo="error">{error}</Aviso></div>}
      {aviso && <div className="mt-3"><Aviso tipo="exito">{aviso}</Aviso></div>}
    </section>
  );
}
