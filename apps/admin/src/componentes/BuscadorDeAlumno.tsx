import { useEffect, useId, useRef, useState } from 'react';

import { clasesControl } from './ui/Campo';
import { clientes as api } from '../lib/recursos';
import { documentoLegible } from '../lib/paises';
import type { Cliente } from '../lib/tipos';

/** Desde cuántas letras se empieza a buscar. */
const MINIMO = 2;

/** Cuánto se espera después de la última tecla antes de consultar. */
const ESPERA_MS = 300;

/**
 * Cuántos resultados se piden.
 *
 * Con el buscador andando, nadie recorre una lista de veinte: escribe dos
 * letras más. Pedir menos hace la consulta más barata y la lista más corta.
 */
const RESULTADOS = 20;

/**
 * Elegir un alumno escribiendo, no desplegando una lista.
 *
 * Reemplaza al `<select>` con todos los alumnos cargados de una vez. Ese
 * desplegable tenía dos problemas: con trescientos alumnos hay que recorrer
 * trescientos renglones, y —peor— se pedían solo los primeros cien, así que un
 * alumno de la página dos **no se podía elegir** y nada lo avisaba.
 *
 * Busca por nombre, apellido, cédula o pasaporte. La búsqueda la hace la API
 * (`GET /clientes?q=`), que además es la única que puede: filtrar en el
 * navegador exigiría traerse la tabla entera de alumnos, que es justamente lo
 * que no se quiere.
 */
export function BuscadorDeAlumno({
  valor,
  onElegir,
  autoFoco,
}: {
  valor: Cliente | null;
  onElegir: (alumno: Cliente | null) => void;
  autoFoco?: boolean;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [busco, setBusco] = useState(false);
  const idLista = useId();
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const termino = busqueda.trim();
    if (termino.length < MINIMO) {
      setResultados([]);
      setBusco(false);
      return;
    }

    setBuscando(true);
    // `vigente` vive acá afuera, no adentro del temporizador: devolver una
    // función de limpieza desde adentro de un `setTimeout` no la ejecuta nadie.
    let vigente = true;

    const temporizador = setTimeout(() => {
      void api
        .listar({ q: termino, porPagina: RESULTADOS })
        .then((pagina) => {
          // Sin esto, una respuesta lenta de «Ro» puede pisar la de «Rodríguez»
          // y mostrar resultados que ya no corresponden a lo que se ve escrito.
          if (!vigente) return;
          setResultados(pagina.datos);
          setBusco(true);
        })
        .catch(() => {
          if (vigente) setResultados([]);
        })
        .finally(() => {
          if (vigente) setBuscando(false);
        });
    }, ESPERA_MS);

    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [busqueda]);

  // Ya hay alumno elegido: se muestra cuál es y cómo cambiarlo.
  if (valor) {
    return (
      <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-marca-600 bg-marca-50 px-3 py-2">
        <span className="text-sm">
          <span className="font-medium text-slate-900">
            {valor.nombre} {valor.apellido}
          </span>
          {valor.documento && (
            <span className="block text-xs text-slate-600">{documentoLegible(valor)}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            onElegir(null);
            setBusqueda('');
            setResultados([]);
            // El foco vuelve al buscador: quien toca «Cambiar» quiere escribir.
            setTimeout(() => entrada.current?.focus(), 0);
          }}
          className="shrink-0 text-sm text-marca-700 underline"
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={entrada}
        type="search"
        value={busqueda}
        autoFocus={autoFoco}
        onChange={(evento) => setBusqueda(evento.target.value)}
        placeholder="Nombre, apellido, cédula o pasaporte"
        role="combobox"
        aria-expanded={resultados.length > 0}
        aria-controls={idLista}
        aria-autocomplete="list"
        className={clasesControl}
      />

      {resultados.length > 0 && (
        <ul
          id={idLista}
          role="listbox"
          className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200"
        >
          {resultados.map((candidato) => (
            <li key={candidato.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => onElegir(candidato)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">
                  {candidato.apellido}, {candidato.nombre}
                </span>
                {candidato.documento && (
                  <span className="ml-2 text-xs text-slate-500">
                    {documentoLegible(candidato)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Los tres estados que el usuario necesita distinguir: escribí poco,
          estoy buscando, y no hay nadie con eso. Sin el último, un error de
          tipeo se ve igual que una lista todavía cargando. */}
      {busqueda.trim().length > 0 && busqueda.trim().length < MINIMO && (
        <p className="mt-1 text-xs text-slate-500">Escribí al menos {MINIMO} letras.</p>
      )}
      {buscando && <p className="mt-1 text-xs text-slate-500">Buscando…</p>}
      {!buscando && busco && resultados.length === 0 && (
        <p className="mt-1 text-xs text-slate-500">
          Ningún alumno con eso. Probá con el apellido o el número de documento.
        </p>
      )}
    </>
  );
}
