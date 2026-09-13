import type { Graduado } from '../lib/tipos';

const CATEGORIA: Record<string, string> = {
  A: 'Automóvil',
  G1: 'Ciclomotor',
  G2: 'Motocicleta',
  G3: 'Motocicleta',
};

/**
 * Diploma de egresado, listo para imprimir.
 *
 * Lo que NO lleva es tan importante como lo que lleva: sin número de documento,
 * sin fecha de nacimiento, sin domicilio y sin número de libreta. Ese es el
 * punto del diploma. La foto de egresado se saca sosteniendo esto y no la
 * libreta, que muestra todos esos datos y convierte una foto simpática en un
 * riesgo de suplantación de identidad para el alumno.
 *
 * El código de verificación permite comprobar que el diploma es auténtico sin
 * que el papel tenga que mostrar ningún dato más.
 */
export function Diploma({ graduado, sitioUrl }: { graduado: Graduado; sitioUrl: string }) {
  const fecha = new Date(`${graduado.fechaEgreso.slice(0, 10)}T12:00:00`);
  const fechaTexto = new Intl.DateTimeFormat('es-UY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fecha);

  return (
    <div className="diploma mx-auto w-full max-w-3xl bg-white p-10 text-center text-carbon-950">
      <div className="border-4 border-marca-500 p-10">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-marca-600">
          Academia de Choferes
        </p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight">
          GIMENOOS<span className="text-marca-500">.</span>
        </p>
        <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">
          San Carlos · Maldonado · Uruguay
        </p>

        <div aria-hidden="true" className="mx-auto my-8 h-1 w-24 rounded-full bg-acento-400" />

        <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Certifica que</p>
        <p className="mt-3 text-4xl font-extrabold leading-tight">
          {graduado.cliente.nombre} {graduado.cliente.apellido}
        </p>

        <p className="mx-auto mt-6 max-w-xl text-slate-700">
          completó su formación práctica de manejo en esta academia, en la categoría{' '}
          <strong className="font-bold text-carbon-950">
            {graduado.categoria} — {CATEGORIA[graduado.categoria] ?? graduado.categoria}
          </strong>
          .
        </p>

        <p className="mt-8 text-sm text-slate-600">{fechaTexto}</p>

        <div className="mt-12 grid grid-cols-2 items-end gap-8">
          <div>
            <div className="mx-auto w-48 border-t border-slate-400" />
            <p className="mt-2 text-xs text-slate-500">Firma de la academia</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Código de verificación
            </p>
            <p className="mt-1 font-mono text-xl font-bold tracking-[0.2em]">{graduado.codigo}</p>
            <p className="mt-1 text-[10px] text-slate-400">{sitioUrl}/diploma</p>
          </div>
        </div>
      </div>
    </div>
  );
}
