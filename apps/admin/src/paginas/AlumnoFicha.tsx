import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Aviso } from '../componentes/ui/Aviso';
import { Boton } from '../componentes/ui/Boton';
import { FormularioAlumno } from './Alumnos';
import { clientes as api } from '../lib/recursos';
import { documentoLegible } from '../lib/paises';
import { fechaCorta, fechaYHora } from '../lib/fecha';
import { useSesion } from '../lib/sesion';
import { ETIQUETA_ESTADO, type FichaCliente } from '../lib/tipos';

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
