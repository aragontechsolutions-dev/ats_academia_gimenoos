import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Modal } from '../componentes/ui/Modal';
import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { Campo, clasesControl } from '../componentes/ui/Campo';
import { clientes as api } from '../lib/recursos';
import { PAISES, documentoLegible } from '../lib/paises';
import { useSesion } from '../lib/sesion';
import type { Cliente } from '../lib/tipos';

export function Alumnos() {
  const { perfil } = useSesion();
  const esAdmin = perfil?.rol === 'ADMIN';

  const [lista, setLista] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Cliente | 'nuevo' | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    void api
      .listar({ q: busqueda.trim() || undefined, incluirInactivos })
      .then(setLista)
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargando(false));
  }, [busqueda, incluirInactivos]);

  // Espera antes de consultar, para no disparar una búsqueda por cada tecla.
  useEffect(() => {
    const temporizador = setTimeout(cargar, 300);
    return () => clearTimeout(temporizador);
  }, [cargar]);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Alumnos</h1>
        {esAdmin && <Boton onClick={() => setEditando('nuevo')}>Nuevo alumno</Boton>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder={esAdmin ? 'Buscar por nombre, apellido, correo o cédula' : 'Buscar por nombre o correo'}
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-marca-600 focus:outline-none"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={incluirInactivos}
            onChange={(evento) => setIncluirInactivos(evento.target.checked)}
            className="rounded border-slate-300"
          />
          Incluir inactivos
        </label>
        {cargando && <span className="text-sm text-slate-500">Buscando…</span>}
      </div>

      {error && (
        <div className="mt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Alumno</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Correo</th>
              {esAdmin && <th className="px-4 py-3 font-medium">Documento</th>}
              <th className="px-4 py-3 font-medium">Cuenta</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((alumno) => (
              <tr key={alumno.id} className={alumno.activo ? '' : 'bg-slate-50 text-slate-400'}>
                <td className="px-4 py-3">
                  <Link to={`/alumnos/${alumno.id}`} className="font-medium text-marca-700 hover:underline">
                    {alumno.apellido}, {alumno.nombre}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{alumno.telefono ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{alumno.email ?? '—'}</td>
                {esAdmin && <td className="px-4 py-3 text-slate-600">{documentoLegible(alumno)}</td>}
                <td className="px-4 py-3">
                  {alumno.usuarioId ? (
                    <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      Con acceso
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Sin cuenta</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {esAdmin && (
                    <button
                      type="button"
                      onClick={() => setEditando(alumno)}
                      className="text-marca-600 hover:underline"
                    >
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!cargando && lista.length === 0 && (
          <p className="p-6 text-center text-slate-500">
            {busqueda ? 'Ningún alumno coincide con la búsqueda.' : 'Todavía no hay alumnos cargados.'}
          </p>
        )}
      </div>

      {editando && (
        <FormularioAlumno
          alumno={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={cargar}
        />
      )}
    </>
  );
}

export function FormularioAlumno({
  alumno,
  onCerrar,
  onGuardado,
}: {
  alumno: Cliente | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [datos, setDatos] = useState({
    nombre: alumno?.nombre ?? '',
    apellido: alumno?.apellido ?? '',
    telefono: alumno?.telefono ?? '',
    email: alumno?.email ?? '',
    tipoDocumento: alumno?.tipoDocumento ?? 'CEDULA',
    paisDocumento: alumno?.paisDocumento ?? 'UY',
    documento: alumno?.documento ?? '',
    fechaNacimiento: alumno?.fechaNacimiento?.slice(0, 10) ?? '',
    direccion: alumno?.direccion ?? '',
    ciudad: alumno?.ciudad ?? 'San Carlos',
    notasInternas: alumno?.notasInternas ?? '',
    activo: alumno?.activo ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    const cuerpo = {
      nombre: datos.nombre,
      apellido: datos.apellido,
      telefono: datos.telefono || undefined,
      email: datos.email || undefined,
      tipoDocumento: datos.tipoDocumento,
      // El país solo importa para el pasaporte: la cédula uruguaya la emite
      // Uruguay por definición, y el servidor lo fuerza igual.
      ...(datos.tipoDocumento === 'PASAPORTE' ? { paisDocumento: datos.paisDocumento } : {}),
      documento: datos.documento || undefined,
      fechaNacimiento: datos.fechaNacimiento || undefined,
      direccion: datos.direccion || undefined,
      ciudad: datos.ciudad || undefined,
      notasInternas: datos.notasInternas || undefined,
      ...(alumno ? { activo: datos.activo } : {}),
    };
    try {
      if (alumno) await api.actualizar(alumno.id, cuerpo);
      else await api.crear(cuerpo);
      onGuardado();
      onCerrar();
    } catch (problema) {
      setError((problema as Error).message);
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={alumno ? 'Editar alumno' : 'Nuevo alumno'} onCerrar={onCerrar} ancho="max-w-xl">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" requerido>
            <input
              value={datos.nombre}
              onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
              className={clasesControl}
            />
          </Campo>
          <Campo etiqueta="Apellido" requerido>
            <input
              value={datos.apellido}
              onChange={(e) => setDatos({ ...datos, apellido: e.target.value })}
              className={clasesControl}
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Teléfono">
            <input
              value={datos.telefono}
              onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
              className={clasesControl}
            />
          </Campo>
          <Campo
            etiqueta="Correo"
            ayuda="Con este correo se vincula su ficha si después se crea una cuenta"
          >
            <input
              type="email"
              value={datos.email}
              onChange={(e) => setDatos({ ...datos, email: e.target.value })}
              className={clasesControl}
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Documento">
            <select
              value={datos.tipoDocumento}
              onChange={(e) =>
                setDatos({
                  ...datos,
                  tipoDocumento: e.target.value as 'CEDULA' | 'PASAPORTE',
                  // Al cambiar de tipo se limpia el número: una cédula no es un
                  // pasaporte válido ni al revés, y dejarlo puesto solo genera
                  // un error al guardar.
                  documento: '',
                  paisDocumento: e.target.value === 'CEDULA' ? 'UY' : datos.paisDocumento,
                })
              }
              className={clasesControl}
            >
              <option value="CEDULA">Cédula uruguaya</option>
              <option value="PASAPORTE">Pasaporte (extranjero)</option>
            </select>
          </Campo>
          <Campo etiqueta="Fecha de nacimiento">
            <input
              type="date"
              value={datos.fechaNacimiento}
              onChange={(e) => setDatos({ ...datos, fechaNacimiento: e.target.value })}
              className={clasesControl}
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {datos.tipoDocumento === 'PASAPORTE' && (
            <Campo etiqueta="País que lo emitió" requerido>
              <select
                value={datos.paisDocumento}
                onChange={(e) => setDatos({ ...datos, paisDocumento: e.target.value })}
                className={clasesControl}
              >
                {PAISES.map((pais) => (
                  <option key={pais.codigo} value={pais.codigo}>
                    {pais.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <Campo
            etiqueta={datos.tipoDocumento === 'CEDULA' ? 'Número de cédula' : 'Número de pasaporte'}
            ayuda={
              datos.tipoDocumento === 'CEDULA'
                ? 'Solo dígitos. Los puntos y guiones se quitan solos.'
                : 'Letras y números. Las letras se pasan a mayúscula solas.'
            }
          >
            <input
              value={datos.documento}
              onChange={(e) =>
                setDatos({
                  ...datos,
                  // El pasaporte se escribe en mayúsculas: se convierte mientras
                  // se tipea para que se vea guardado igual que como va a quedar.
                  documento:
                    datos.tipoDocumento === 'PASAPORTE'
                      ? e.target.value.toUpperCase()
                      : e.target.value,
                })
              }
              className={clasesControl}
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Dirección">
            <input
              value={datos.direccion}
              onChange={(e) => setDatos({ ...datos, direccion: e.target.value })}
              className={clasesControl}
            />
          </Campo>
          <Campo etiqueta="Ciudad">
            <input
              value={datos.ciudad}
              onChange={(e) => setDatos({ ...datos, ciudad: e.target.value })}
              className={clasesControl}
            />
          </Campo>
        </div>

        <Campo etiqueta="Notas internas" ayuda="No las ve el alumno">
          <textarea
            value={datos.notasInternas}
            onChange={(e) => setDatos({ ...datos, notasInternas: e.target.value })}
            rows={2}
            className={clasesControl}
          />
        </Campo>

        {alumno && (
          <Campo etiqueta="Estado">
            <select
              value={String(datos.activo)}
              onChange={(e) => setDatos({ ...datos, activo: e.target.value === 'true' })}
              className={clasesControl}
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </Campo>
        )}

        {error && <Aviso tipo="error">{error}</Aviso>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            disabled={guardando || !datos.nombre || !datos.apellido}
            onClick={() => void guardar()}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
