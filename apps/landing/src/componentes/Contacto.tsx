import { academia } from '../contenido';

const MENSAJE_WHATSAPP = encodeURIComponent(
  'Hola, quiero consultar por las clases de manejo.',
);

export function Contacto() {
  const tieneAlgunDato = Boolean(
    academia.whatsapp || academia.telefono || academia.email || academia.direccion,
  );

  return (
    <section id="contacto" className="bg-marca-900 text-white">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-bold">Empezá hoy</h2>
        <p className="mt-3 max-w-2xl text-marca-100">
          Escribinos y coordinamos tu primera clase. Te respondemos en el día.
        </p>

        {!tieneAlgunDato && (
          // Los datos de contacto todavia no fueron cargados en src/contenido.ts.
          // No se inventa ningun numero: se avisa en consola durante el desarrollo.
          <p className="mt-8 rounded-lg bg-white/10 p-4 text-marca-100">
            Datos de contacto pendientes de carga.
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-4">
          {academia.whatsapp && (
            <a
              href={`https://wa.me/${academia.whatsapp}?text=${MENSAJE_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white px-6 py-3 font-semibold text-marca-900 transition hover:bg-marca-50"
            >
              Escribinos por WhatsApp
            </a>
          )}
          {academia.telefono && (
            <a
              href={`tel:${academia.telefono.replace(/\s/g, '')}`}
              className="rounded-lg border border-white/40 px-6 py-3 font-semibold transition hover:bg-white/10"
            >
              {academia.telefono}
            </a>
          )}
          {academia.email && (
            <a
              href={`mailto:${academia.email}`}
              className="rounded-lg border border-white/40 px-6 py-3 font-semibold transition hover:bg-white/10"
            >
              {academia.email}
            </a>
          )}
        </div>

        <dl className="mt-10 grid gap-6 border-t border-white/20 pt-8 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-marca-100">Dónde estamos</dt>
            <dd className="mt-1 font-semibold">
              {academia.direccion ?? `${academia.ciudad}, ${academia.departamento}`}
            </dd>
          </div>
          {academia.horarios && (
            <div>
              <dt className="text-sm text-marca-100">Horarios</dt>
              <dd className="mt-1 font-semibold">{academia.horarios}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-marca-100">Zona de cobertura</dt>
            <dd className="mt-1 font-semibold">San Carlos y alrededores, Maldonado</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
