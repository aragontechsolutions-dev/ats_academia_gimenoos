import { beneficios } from '../contenido';

/**
 * Barra de confianza con beneficios, no con cifras.
 *
 * La academia todavía no confirmó cantidad de alumnos, años de trayectoria ni
 * porcentaje de aprobados. Inventar un número acá destruiría exactamente la
 * confianza que la sección busca construir.
 */
export function BarraConfianza() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden px-4 py-8 sm:gap-8 lg:grid-cols-4">
        {beneficios.map((beneficio, indice) => (
          <li
            key={beneficio.titulo}
            className="aparece px-2 py-3 sm:px-0"
            style={{ transitionDelay: `${indice * 70}ms` }}
          >
            <p className="flex items-center gap-2 font-extrabold text-carbon-950">
              <span aria-hidden="true" className="h-4 w-1 rounded-full bg-marca-500" />
              {beneficio.titulo}
            </p>
            <p className="mt-1 pl-3 text-sm text-slate-500">{beneficio.detalle}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
