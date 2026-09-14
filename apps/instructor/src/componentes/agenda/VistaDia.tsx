import { AccionesDeLaClase } from '../AccionesDeLaClase';
import { NotaDeClase } from '../NotaDeClase';
import { TarjetaClase } from '../TarjetaClase';
import { ESTADOS_VIGENTES, type Reserva } from '../../lib/tipos';

/**
 * Un día, con las clases completas y todo lo que se puede hacer con ellas.
 *
 * Es la vista de trabajo: la semana y el mes sirven para ubicarse, pero cerrar
 * una clase, anotar cómo fue o llamar al alumno se hace siempre acá. Tener las
 * acciones en un solo lugar evita la peor confusión posible en esta app, que es
 * cerrar la clase equivocada desde una lista apretada.
 */
export function VistaDia({
  reservas,
  yaEmpezo,
  onCambiada,
}: {
  reservas: Reserva[];
  yaEmpezo: (reserva: Reserva) => boolean;
  onCambiada: () => void;
}) {
  // Las canceladas y cerradas se muestran al final y no se esconden: si un
  // alumno aparece igual, el instructor tiene que poder ver que esa clase se dio
  // de baja.
  const vigentes = reservas.filter((r) => ESTADOS_VIGENTES.includes(r.estado));
  const cerradas = reservas.filter((r) => !ESTADOS_VIGENTES.includes(r.estado));

  return (
    <>
      <div className="space-y-3">
        {vigentes.map((reserva) => (
          <TarjetaClase
            key={reserva.id}
            reserva={reserva}
            acciones={
              <AccionesDeLaClase
                reserva={reserva}
                yaEmpezo={yaEmpezo(reserva)}
                onCambiada={onCambiada}
              />
            }
            // Se puede anotar desde que la clase empezó. Antes no hay nada que
            // contar.
            nota={yaEmpezo(reserva) ? <NotaDeClase reserva={reserva} onGuardada={onCambiada} /> : undefined}
          />
        ))}
      </div>

      {cerradas.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Cerradas y canceladas
          </h2>
          <div className="mt-3 space-y-3">
            {cerradas.map((reserva) => (
              <TarjetaClase
                key={reserva.id}
                reserva={reserva}
                // También en las cerradas: lo más común es anotar justo después
                // de terminar, y a veces al día siguiente.
                nota={<NotaDeClase reserva={reserva} onGuardada={onCambiada} />}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
