import { useEffect, useState, type FormEvent } from 'react';

import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { miFicha } from '../lib/recursos';
import { PAISES } from '../lib/paises';
import { fechaCorta } from '../lib/fecha';
import { useSesion } from '../lib/sesion';
import { useAvisos } from '../lib/avisos';
import type { MiFicha } from '../lib/tipos';

const CLASES_CAMPO =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm focus:border-marca-600 focus:outline-none';

/** Lo que el formulario muestra, sacado de la ficha que devolvió la API. */
type Borrador = {
  nombre: string;
  apellido: string;
  telefono: string;
  tipoDocumento: 'CEDULA' | 'PASAPORTE';
  paisDocumento: string;
  documento: string;
  fechaNacimiento: string;
  direccion: string;
};

const borradorDe = (ficha: MiFicha): Borrador => ({
  nombre: ficha.nombre,
  apellido: ficha.apellido,
  telefono: ficha.telefono ?? '',
  tipoDocumento: ficha.tipoDocumento ?? 'CEDULA',
  paisDocumento: ficha.paisDocumento ?? 'UY',
  documento: ficha.documento ?? '',
  fechaNacimiento: ficha.fechaNacimiento?.slice(0, 10) ?? '',
  direccion: ficha.direccion ?? '',
});

export function MiPerfil() {
  const { cerrarSesion } = useSesion();
  const avisos = useAvisos();
  const [ficha, setFicha] = useState<MiFicha | null>(null);
  // Arranca en null, igual que la ficha: el formulario no se dibuja hasta que
  // los datos están. Ver el porqué abajo, en el `if (!ficha)`.
  const [datos, setDatos] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void miFicha
      .obtener()
      .then((resultado) => {
        setFicha(resultado);
        setDatos(borradorDe(resultado));
      })
      .catch((problema: Error) => setError(problema.message));
  }, []);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (!datos) return;
    setGuardando(true);
    try {
      const actualizada = await miFicha.actualizar({
        nombre: datos.nombre,
        apellido: datos.apellido,
        telefono: datos.telefono || undefined,
        tipoDocumento: datos.tipoDocumento,
        ...(datos.tipoDocumento === 'PASAPORTE' ? { paisDocumento: datos.paisDocumento } : {}),
        documento: datos.documento || undefined,
        fechaNacimiento: datos.fechaNacimiento || undefined,
        direccion: datos.direccion || undefined,
      });
      // El formulario vuelve a leerse de lo que quedó guardado, no de lo que se
      // tipeó: la API normaliza algunos datos —el teléfono 092331784 se guarda
      // como +598 92331784— y dejar en pantalla la versión sin normalizar hace
      // creer que el cambio no se aplicó.
      const fresca = { ...(ficha as MiFicha), ...actualizada };
      setFicha(fresca);
      setDatos(borradorDe(fresca));
      avisos.exito('Datos guardados');
    } catch (problema) {
      avisos.error(problema);
    } finally {
      setGuardando(false);
    }
  }

  if (error) {
    return (
      <>
        <h1 className="text-2xl font-bold text-slate-900">Mi perfil</h1>
        <div className="mt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      </>
    );
  }

  /**
   * Hasta que la ficha no llega, no hay formulario.
   *
   * Antes se dibujaba vacío y se completaba solo al llegar los datos. Eso hacía
   * dos cosas malas a la vez: mostraba «sin nombre» a alguien que sí tiene
   * nombre, y —peor— si el alumno empezaba a escribir en ese rato, la respuesta
   * le pisaba lo tipeado sin decir nada. Guardaba, avisaba «Datos guardados» y
   * el dato no estaba.
   */
  if (!ficha || !datos) return <p className="mt-6 text-slate-500">Cargando…</p>;

  const packsConSaldo = ficha.compras.filter((c) => c.clasesUsadas < c.clasesTotales);

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
          <span className="text-sm font-medium text-slate-700">Documento</span>
          <select
            value={datos.tipoDocumento}
            onChange={(e) =>
              setDatos({
                ...datos,
                tipoDocumento: e.target.value as 'CEDULA' | 'PASAPORTE',
                documento: '',
                paisDocumento: e.target.value === 'CEDULA' ? 'UY' : datos.paisDocumento,
              })
            }
            className={CLASES_CAMPO}
          >
            <option value="CEDULA">Cédula uruguaya</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>
        </label>

        {datos.tipoDocumento === 'PASAPORTE' && (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">País que lo emitió</span>
            <select
              value={datos.paisDocumento}
              onChange={(e) => setDatos({ ...datos, paisDocumento: e.target.value })}
              className={CLASES_CAMPO}
            >
              {PAISES.map((pais) => (
                <option key={pais.codigo} value={pais.codigo}>
                  {pais.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            {datos.tipoDocumento === 'CEDULA' ? 'Número de cédula' : 'Número de pasaporte'}
          </span>
          <input
            inputMode={datos.tipoDocumento === 'CEDULA' ? 'numeric' : 'text'}
            value={datos.documento}
            onChange={(e) =>
              setDatos({
                ...datos,
                documento:
                  datos.tipoDocumento === 'PASAPORTE'
                    ? e.target.value.toUpperCase()
                    : e.target.value,
              })
            }
            className={CLASES_CAMPO}
          />
          <span className="mt-1 block text-xs text-slate-500">
            {datos.tipoDocumento === 'CEDULA'
              ? 'Solo dígitos. Los puntos y guiones se quitan solos. Hace falta para el trámite de la libreta.'
              : 'Letras y números. Las letras se pasan a mayúscula solas.'}
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
