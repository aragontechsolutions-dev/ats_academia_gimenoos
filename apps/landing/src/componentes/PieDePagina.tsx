import { Facebook, Instagram, Mail, MapPin, Phone } from 'lucide-react';
import { legal, navegacion } from '../contenido';
import { useNegocio } from '../contexto/ContenidoContexto';

export function PieDePagina() {
  const negocio = useNegocio();
  const redes = [
    { url: negocio.instagram, Icono: Instagram, nombre: 'Instagram' },
    { url: negocio.facebook, Icono: Facebook, nombre: 'Facebook' },
  ].filter((red): red is { url: string; Icono: typeof Instagram; nombre: string } =>
    Boolean(red.url),
  );

  return (
    <footer className="bg-carbon-950 text-slate-400">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-2">
          <p className="text-2xl font-extrabold tracking-tight text-white">
            {negocio.nombreCorto}
            <span className="text-marca-500">.</span>
          </p>
          <p className="mt-3 max-w-sm text-sm">
            {negocio.descripcionCorta} Clases de moto y auto, y acompañamiento del trámite de la
            libreta.
          </p>

          {redes.length > 0 && (
            <ul className="mt-6 flex gap-3">
              {redes.map(({ url, Icono, nombre }) => (
                <li key={nombre}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white transition hover:bg-marca-500"
                  >
                    <Icono size={18} aria-hidden="true" />
                    <span className="sr-only">{nombre}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav aria-label="Secciones del sitio">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">Secciones</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {navegacion.map((item) => (
              <li key={item.destino}>
                <a href={item.destino} className="transition hover:text-white">
                  {item.texto}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">Contacto</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-marca-500" />
              {negocio.direccion ?? `${negocio.ciudad}, ${negocio.departamento}`}
            </li>
            {negocio.telefono && (
              <li className="flex items-start gap-2">
                <Phone size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-marca-500" />
                <a
                  href={`tel:${negocio.telefono.replace(/\s/g, '')}`}
                  className="transition hover:text-white"
                >
                  {negocio.telefono}
                </a>
              </li>
            )}
            {negocio.email && (
              <li className="flex items-start gap-2">
                <Mail size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-marca-500" />
                <a href={`mailto:${negocio.email}`} className="transition hover:text-white">
                  {negocio.email}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {negocio.nombre} · {negocio.ciudad},{' '}
            {negocio.departamento}, {negocio.pais}
          </p>
          <nav className="flex gap-5" aria-label="Enlaces legales">
            <a href={legal.politicaPrivacidad} className="transition hover:text-white">
              Política de privacidad
            </a>
            <a href={legal.terminos} className="transition hover:text-white">
              Términos y condiciones
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
