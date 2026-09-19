import { useState } from 'react';
import { MANUALES, ORDEN_DE_MANUALES, type RolDelManual } from '@gimenoos/shared';

/** Cómo se nombra cada manual en el selector. */
const ETIQUETA: Record<RolDelManual, string> = {
  ADMIN: 'Administración',
  INSTRUCTOR: 'Instructor',
  CLIENTE: 'Alumno',
};

/**
 * Los tres manuales, en el panel.
 *
 * Que estén los tres y no solo el de administración es el punto: cuando un
 * alumno llama sin entender una pantalla, quien atiende necesita leer **lo
 * mismo que esa persona está viendo**, no una versión aproximada de memoria.
 *
 * El texto sale de `@gimenoos/shared`, que es de donde lo toman también las dos
 * aplicaciones. Una sola fuente: no hay forma de que el manual del alumno y el
 * que lee la academia digan cosas distintas.
 */
export function Manuales() {
  const [rol, setRol] = useState<RolDelManual>('ADMIN');
  const manual = MANUALES[rol];

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Manuales</h1>
        <p className="mt-1 text-sm text-slate-600">
          El de administración y también los que ven el instructor y el alumno, para poder
          acompañarlos por teléfono mirando lo mismo que ellos.
        </p>
      </header>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Elegir manual">
        {ORDEN_DE_MANUALES.map((opcion) => (
          <button
            key={opcion}
            type="button"
            aria-pressed={rol === opcion}
            onClick={() => setRol(opcion)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              rol === opcion
                ? 'border-marca-600 bg-marca-600 text-white'
                : 'border-slate-300 text-slate-700 hover:border-slate-400'
            }`}
          >
            {ETIQUETA[opcion]}
          </button>
        ))}
      </div>

      <div className="mt-6 lg:flex lg:items-start lg:gap-8">
        {/* El índice queda fijo al costado: el manual de administración tiene
            quince secciones y buscar una desplazándose es perder el hilo. */}
        <nav
          aria-label="Secciones del manual"
          className="hidden shrink-0 lg:sticky lg:top-6 lg:block lg:w-56"
        >
          <ul className="space-y-1 text-sm">
            {manual.secciones.map((seccion) => (
              <li key={seccion.id}>
                <a
                  href={`#${seccion.id}`}
                  className="block rounded px-2 py-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {seccion.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900">{manual.titulo}</h2>
          <p className="mt-1 text-sm text-slate-600">{manual.bajada}</p>

          <div className="mt-5 space-y-5">
            {manual.secciones.map((seccion) => (
              <section
                key={seccion.id}
                id={seccion.id}
                className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-5"
              >
                <h3 className="font-semibold text-slate-900">{seccion.titulo}</h3>
                {seccion.intro && <p className="mt-1 text-sm text-slate-600">{seccion.intro}</p>}

                {seccion.acciones && (
                  <ul className="mt-3 space-y-2.5">
                    {seccion.acciones.map((accion) => (
                      <li key={accion.que} className="text-sm">
                        <span className="font-medium text-slate-900">{accion.que}</span>
                        {accion.como && <span className="text-slate-600"> — {accion.como}</span>}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Los flujos se numeran y dicen QUIÉN hace cada paso. Un flujo
                    sin el actor de cada paso no se puede seguir: lo importante
                    no es solo el orden, es de quién depende que avance. */}
                {seccion.flujo && (
                  <ol className="mt-3 space-y-2.5">
                    {seccion.flujo.map((paso, indice) => (
                      <li key={`${paso.quien}-${indice}`} className="flex gap-3 text-sm">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                          {indice + 1}
                        </span>
                        <span>
                          <span className="font-medium text-slate-900">{paso.quien}</span>
                          <span className="text-slate-600"> — {paso.hace}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}

                {seccion.aviso && (
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    {seccion.aviso}
                  </p>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
