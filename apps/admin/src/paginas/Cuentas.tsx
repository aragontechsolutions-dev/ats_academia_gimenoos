import { useCallback, useEffect, useState } from 'react';

import { Modal } from '../componentes/ui/Modal';
import { Paginacion, PAGINA_VACIA, type Pagina } from '../componentes/ui/Paginacion';
import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { Campo, clasesControl } from '../componentes/ui/Campo';
import {
  usuarios as api,
  invitaciones as apiInvitaciones,
  instructores as apiInstructores,
} from '../lib/recursos';
import { fechaCorta } from '../lib/fecha';
import { useSesion } from '../lib/sesion';
import { ETIQUETA_ROL, type CuentaUsuario, type Instructor, type Invitacion, type Rol } from '../lib/tipos';

const ROLES: Rol[] = ['ADMIN', 'INSTRUCTOR', 'CLIENTE'];

export function Cuentas() {
  const { perfil } = useSesion();
  const [pagina, setPagina] = useState<Pagina<CuentaUsuario>>(PAGINA_VACIA as Pagina<CuentaUsuario>);
  const [consulta, setConsulta] = useState({ pagina: 1, porPagina: 10 });
  const [rol, setRol] = useState<Rol | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const [incluirInactivos, setIncluirInactivos] = useState(true);
  const [pendientes, setPendientes] = useState<Invitacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [invitando, setInvitando] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    void api
      .listar({
        ...consulta,
        incluirInactivos,
        ...(rol ? { rol } : {}),
        ...(busqueda.trim() ? { q: busqueda.trim() } : {}),
      })
      .then(setPagina)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargando(false));

    void apiInvitaciones
      .listar({ estado: 'PENDIENTE' })
      .then(setPendientes)
      .catch(() => setPendientes([]));
  }, [consulta, rol, busqueda, incluirInactivos]);

  useEffect(cargar, [cargar]);

  const accion = async (promesa: Promise<unknown>, exito: string) => {
    setError(null);
    setAviso(null);
    try {
      await promesa;
      setAviso(exito);
      cargar();
    } catch (problema) {
      setError((problema as Error).message);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cuentas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quién puede entrar al sistema y con qué permisos.
          </p>
        </div>
        <Boton onClick={() => setInvitando(true)}>Invitar</Boton>
      </div>

      {error && <div className="mt-4"><Aviso tipo="error">{error}</Aviso></div>}
      {aviso && <div className="mt-4"><Aviso tipo="exito">{aviso}</Aviso></div>}

      {pendientes.length > 0 && (
        <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900">
            Invitaciones sin usar ({pendientes.length})
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {pendientes.map((invitacion) => {
              const ficha = invitacion.cliente ?? invitacion.instructor;
              return (
                <li key={invitacion.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-amber-900">
                    <strong>{invitacion.email}</strong>
                    <span className="ml-2 text-amber-800">{ETIQUETA_ROL[invitacion.rol]}</span>
                    {ficha && <span className="ml-2 text-amber-700">· {ficha.nombre} {ficha.apellido}</span>}
                    <span className="ml-2 text-amber-700">
                      {invitacion.enviadaAt
                        ? `· enviada ${fechaCorta(invitacion.enviadaAt)}`
                        : '· el correo no salió'}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void accion(apiInvitaciones.reenviar(invitacion.id), 'Se reenvió el correo.')
                      }
                      className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-900 hover:bg-amber-100"
                    >
                      Reenviar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`¿Dar de baja la invitación de ${invitacion.email}?`)) {
                          void accion(apiInvitaciones.revocar(invitacion.id), 'Invitación dada de baja.');
                        }
                      }}
                      className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-900 hover:bg-amber-100"
                    >
                      Dar de baja
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Buscar</span>
          <input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setConsulta((actual) => ({ ...actual, pagina: 1 }));
            }}
            placeholder="Nombre o correo"
            className={`${clasesControl} w-56`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Rol</span>
          <select
            value={rol}
            onChange={(e) => {
              setRol(e.target.value as Rol | '');
              setConsulta((actual) => ({ ...actual, pagina: 1 }));
            }}
            className={`${clasesControl} w-44`}
          >
            <option value="">Todos</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-3 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={incluirInactivos}
            onChange={(e) => setIncluirInactivos(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Mostrar cuentas dadas de baja
        </label>
      </div>

      {cargando && <p className="mt-4 text-slate-500">Cargando…</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Persona</th>
              <th className="px-4 py-3 font-medium">Correo</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Entró desde</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagina.datos.map((cuenta) => {
              const ficha = cuenta.cliente ?? cuenta.instructor;
              const esYo = cuenta.id === perfil?.id;
              const nombre =
                [cuenta.nombre, cuenta.apellido].filter(Boolean).join(' ') ||
                (ficha ? `${ficha.nombre} ${ficha.apellido}` : '—');
              return (
                <tr key={cuenta.id} className={cuenta.activo ? '' : 'bg-slate-50'}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {nombre}
                    {esYo && <span className="ml-2 text-xs font-normal text-slate-400">(vos)</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{cuenta.email}</td>
                  <td className="px-4 py-3">
                    {esYo ? (
                      <span className="text-slate-600">{ETIQUETA_ROL[cuenta.rol]}</span>
                    ) : (
                      <select
                        value={cuenta.rol}
                        onChange={(e) =>
                          void accion(
                            api.actualizar(cuenta.id, { rol: e.target.value as Rol }),
                            'Rol actualizado.',
                          )
                        }
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fechaCorta(cuenta.createdAt)}</td>
                  <td className="px-4 py-3">
                    {cuenta.activo ? (
                      <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        Activa
                      </span>
                    ) : (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        De baja
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!esYo && (
                      <button
                        type="button"
                        onClick={() => {
                          const texto = cuenta.activo
                            ? `¿Dar de baja la cuenta de ${cuenta.email}? Deja de poder entrar, pero su historial se conserva.`
                            : `¿Reactivar la cuenta de ${cuenta.email}?`;
                          if (window.confirm(texto)) {
                            void accion(
                              api.actualizar(cuenta.id, { activo: !cuenta.activo }),
                              cuenta.activo ? 'Cuenta dada de baja.' : 'Cuenta reactivada.',
                            );
                          }
                        }}
                        className={
                          cuenta.activo
                            ? 'text-red-600 hover:underline'
                            : 'text-marca-600 hover:underline'
                        }
                      >
                        {cuenta.activo ? 'Dar de baja' : 'Reactivar'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!cargando && pagina.datos.length === 0 && (
          <p className="p-6 text-center text-slate-500">Ninguna cuenta coincide con la búsqueda.</p>
        )}
      </div>

      <Paginacion
        pagina={pagina}
        etiqueta="cuentas"
        onCambio={(cambios) => setConsulta((actual) => ({ ...actual, ...cambios }))}
      />

      {invitando && (
        <FormularioInvitacion
          onCerrar={() => setInvitando(false)}
          onInvitado={(mensaje) => {
            setAviso(mensaje);
            cargar();
          }}
        />
      )}
    </>
  );
}

/**
 * Invitar a alguien de la casa.
 *
 * A los alumnos NO se los invita desde acá sino desde su ficha: ahí está el dato
 * que hace falta —a qué ficha pertenece la cuenta— y el correo ya cargado.
 */
function FormularioInvitacion({
  onCerrar,
  onInvitado,
}: {
  onCerrar: () => void;
  onInvitado: (mensaje: string) => void;
}) {
  const [rol, setRol] = useState<'INSTRUCTOR' | 'ADMIN'>('INSTRUCTOR');
  const [email, setEmail] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [sinCuenta, setSinCuenta] = useState<Instructor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // porPagina 100: es un desplegable, no una lista paginada. Con el valor por
    // defecto mostraría diez instructores y escondería el resto sin avisar.
    void apiInstructores
      .listar({ porPagina: 100 })
      .then((p) => setSinCuenta(p.datos.filter((i) => !i.usuarioId && i.activo)))
      .catch(() => setSinCuenta([]));
  }, []);

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      await apiInvitaciones.crear({
        rol,
        email,
        ...(rol === 'INSTRUCTOR' ? { instructorId } : {}),
      });
      onInvitado(`Listo, le mandamos la invitación a ${email}.`);
      onCerrar();
    } catch (problema) {
      setError((problema as Error).message);
      setEnviando(false);
    }
  }

  const falta = !email || (rol === 'INSTRUCTOR' && !instructorId);

  return (
    <Modal titulo="Invitar a alguien de la academia" onCerrar={onCerrar}>
      <div className="space-y-4">
        <Aviso tipo="info">
          A los alumnos se los invita desde su ficha, en Alumnos. Acá se invita a quienes
          trabajan en la academia.
        </Aviso>

        <Campo etiqueta="Para qué" requerido>
          <select
            value={rol}
            onChange={(e) => {
              setRol(e.target.value as 'INSTRUCTOR' | 'ADMIN');
              setInstructorId('');
            }}
            className={clasesControl}
          >
            <option value="INSTRUCTOR">Instructor</option>
            <option value="ADMIN">Administración</option>
          </select>
        </Campo>

        {rol === 'INSTRUCTOR' && (
          <Campo
            etiqueta="Qué instructor"
            requerido
            ayuda="Solo aparecen los que están activos y todavía no tienen cuenta"
          >
            <select
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              className={clasesControl}
            >
              <option value="">Elegir…</option>
              {sinCuenta.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.nombre} {instructor.apellido}
                </option>
              ))}
            </select>
          </Campo>
        )}

        {rol === 'INSTRUCTOR' && sinCuenta.length === 0 && (
          <Aviso tipo="info">
            Todos los instructores activos ya tienen cuenta. Si falta alguno, cargalo primero
            en Instructores.
          </Aviso>
        )}

        <Campo etiqueta="Correo" requerido ayuda="Ahí le llega el enlace para entrar">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={clasesControl}
          />
        </Campo>

        {error && <Aviso tipo="error">{error}</Aviso>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton disabled={enviando || falta} onClick={() => void enviar()}>
            {enviando ? 'Enviando…' : 'Mandar invitación'}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
