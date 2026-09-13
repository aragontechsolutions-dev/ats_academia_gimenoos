import { Bike, Car } from 'lucide-react';
import { vehiculos } from '../contenido';
import { Seccion, TituloSeccion } from './ui/Seccion';
import { useSeccion } from '../contexto/ContenidoContexto';
import { texto } from '../lib/contenidoRemoto';

/**
 * Los vehículos de la academia.
 *
 * Mientras no haya vehículos reales cargados la sección no existe: mostrar un
 * auto genérico de banco de imágenes sería afirmar que la academia tiene un
 * vehículo que quizá no tiene.
 */
export function Vehiculos() {
  const config = useSeccion('vehiculos');
  if (!config.visible || vehiculos.length === 0) return null;

  return (
    <Seccion id="vehiculos">
      <TituloSeccion
        sobretitulo={texto(config.etiqueta, 'Nuestra flota')}
        titulo={texto(config.titulo, 'Con qué vas a practicar')}
        bajada={texto(config.bajada, 'Los vehículos los pone la academia, mantenidos y preparados para clases.')}
      />

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {vehiculos.map((vehiculo, indice) => {
          const Icono = vehiculo.tipo === 'moto' ? Bike : Car;
          return (
            <article
              key={vehiculo.nombre}
              className="aparece overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-xl hover:shadow-carbon-950/5"
              style={{ transitionDelay: `${indice * 80}ms` }}
            >
              {vehiculo.foto && (
                <img
                  src={vehiculo.foto}
                  alt={`Vehículo de la academia: ${vehiculo.nombre}`}
                  loading="lazy"
                  className="h-48 w-full object-cover"
                />
              )}
              <div className="p-6">
                <h3 className="flex items-center gap-2 text-lg font-bold text-carbon-950">
                  <Icono size={20} aria-hidden="true" className="text-marca-500" />
                  {vehiculo.nombre}
                </h3>
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  {vehiculo.detalles.map((detalle) => (
                    <li key={detalle}>{detalle}</li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </Seccion>
  );
}
