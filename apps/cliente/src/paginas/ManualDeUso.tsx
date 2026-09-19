import { MANUALES, type Manual } from '@gimenoos/shared';

/**
 * El manual del alumno.
 *
 * El texto NO vive acá: viene de `@gimenoos/shared`, porque el panel muestra
 * este mismo manual para que quien atiende lea lo mismo que ve el alumno al que
 * está ayudando por teléfono. Con el texto repartido, los dos se irían
 * separando sin que nadie lo notara.
 *
 * Se dibuja a partir de datos y no de HTML pegado: en este proyecto no hay un
 * solo `dangerouslySetInnerHTML`, y un manual no es motivo para estrenarlo.
 */
export function ManualDeUso() {
  const manual: Manual = MANUALES.CLIENTE;

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-slate-900">{manual.titulo}</h1>
        <p className="mt-1 text-sm text-slate-500">{manual.bajada}</p>
      </header>

      {/* Índice. En un teléfono, seis secciones son bastante desplazamiento:
          esto deja llegar de un toque a la que se está buscando. */}
      <nav aria-label="Secciones del manual" className="mt-5 flex flex-wrap gap-2">
        {manual.secciones.map((seccion) => (
          <a
            key={seccion.id}
            href={`#${seccion.id}`}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700"
          >
            {seccion.titulo}
          </a>
        ))}
      </nav>

      <div className="mt-6 space-y-6">
        {manual.secciones.map((seccion) => (
          <section
            key={seccion.id}
            id={seccion.id}
            // `scroll-mt` deja lugar para el encabezado fijo: sin esto, saltar
            // desde el índice deja el título escondido detrás de la barra.
            className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4"
          >
            <h2 className="font-semibold text-slate-900">{seccion.titulo}</h2>
            {seccion.intro && <p className="mt-1 text-sm text-slate-600">{seccion.intro}</p>}

            {seccion.acciones && (
              <ul className="mt-3 space-y-3">
                {seccion.acciones.map((accion) => (
                  <li key={accion.que}>
                    <p className="text-sm font-medium text-slate-900">{accion.que}</p>
                    {accion.como && <p className="text-sm text-slate-600">{accion.como}</p>}
                  </li>
                ))}
              </ul>
            )}

            {seccion.aviso && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {seccion.aviso}
              </p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
