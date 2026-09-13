import { useEffect, useState, type FormEvent } from 'react';

import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { miFicha } from '../lib/recursos';
import { fechaCorta } from '../lib/fecha';
import { useSesion } from '../lib/sesion';
import type { MiFicha } from '../lib/tipos';

const CLASES_CAMPO =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm focus:border-marca-600 focus:outline-none';

export function MiPerfil() {
  const { cerrarSesion } = useSesion();
  const [ficha, setFicha] = useState<MiFicha | null>(null);
  const [datos, setDatos] = useState({
    nombre: '', apellido: '', telefono: '', cedula: '', fechaNacimiento: '', direccion: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void miFicha
      .obtener()
      .then((resultado) => {
        setFicha(resultado);
        setDatos({
          nombre: resultado.nombre,
          apellido: resultado.apellido,
          telefono: resultado.telefono ?? '',
          cedula: resultado.cedula ?? '',
          fechaNacimiento: resultado.fechaNacimiento?.slice(0, 10) ?? '',
          direccion: resultado.direccion ?? '',
        });
      })
      .catch((problema: Error) => setError(problema.message));
  }, []);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    setGuardado(false);
    try {
      const actualizada = await miFicha.actualizar({
        nombre: datos.nombre,
        apellido: datos.apellido,
        telefono: datos.telefono || undefined,
        cedula: datos.cedula || undefined,
        fechaNacimiento: datos.fechaNacimiento || undefined,
        direccion: datos.direccion || undefined,
      });
      setFicha((actual) => (actual ? { ...actual, ...actualizada } : actual));
      setGuardado(true);
    } catch (problema) {
      setError((problema as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  const packsConSaldo = (ficha?.compras ?? []).filter((c) => c.clasesUsadas < c.clasesTotales);

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Mi perfil</h1>

      {packsConSaldo.length > 0 && (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Tus packs</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {packsConSaldo.map((pack) => (
              <li key={pack.id} className="flex items-center justify-between gap-3">
                <span className="text-slate-700">{pack.servicio.nombre}</span>
                <span className="font-medium text-marca-700">
                  {pack.clasesTotales - pack.clasesUsadas} clases
                  {pack.vigenteHasta && (
                    <span className="ml-1 font-normal text-slate-500">
                      · vence {fechaCorta(pack.vigenteHasta)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={(evento) => void guardar(evento)} className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Nombre</span>
            <input
              value={datos.nombre}
              onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
              required
              className={CLASES_CAMPO}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Apellido</span>
            <input
              value={datos.apellido}
              onChange={(e) => setDatos({ ...datos, apellido: e.target.value })}
              required
              className={CLASES_CAMPO}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Teléfono</span>
          <input
            type="tel"
            value={datos.telefono}
            onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
            className={CLASES_CAMPO}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Cédula</span>
          <input
            inputMode="numeric"
            value={datos.cedula}
            onChange={(e) => setDatos({ ...datos, cedula: e.target.value })}
            className={CLASES_CAMPO}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Solo dígitos, sin puntos ni guiones. Hace falta para el trámite de la libreta.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Fecha de nacimiento</span>
          <input
            type="date"
            value={datos.fechaNacimiento}
            onChange={(e) => setDatos({ ...datos, fechaNacimiento: e.target.value })}
            className={CLASES_CAMPO}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Dirección</span>
          <input
            value={datos.direccion}
            onChange={(e) => setDatos({ ...datos, direccion: e.target.value })}
            className={CLASES_CAMPO}
          />
        </label>

        {error && <Aviso tipo="error">{error}</Aviso>}
        {guardado && <Aviso tipo="exito">Listo, guardamos tus datos.</Aviso>}

        <Boton type="submit" className="w-full" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </Boton>
      </form>

      {ficha?.email && (
        <p className="mt-6 text-center text-xs text-slate-500">
          Ingresás con {ficha.email}
        </p>
      )}

      <Boton variante="secundario" className="mt-3 w-full" onClick={() => void cerrarSesion()}>
        Cerrar sesión
      </Boton>
    </>
  );
}
