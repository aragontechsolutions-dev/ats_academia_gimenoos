import { useMemo } from 'react';
import { Facebook, Instagram, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';

import { legal, navegacion } from '../contenido';
import { useEnlaceWhatsApp, useNegocio, useSeccionVisible } from '../contexto/ContenidoContexto';
import { useEgresados } from '../lib/egresados';

export function PieDePagina() {
  const negocio = useNegocio();
  const wa = useEnlaceWhatsApp();

  // La misma regla que en la barra de arriba: un enlace del pie que apunta a una
  // sección que no existe deja a la persona donde estaba, sin ningún aviso.
  const esVisible = useSeccionVisible();
  const egresados = useEgresados();
  const enlaces = useMemo(
    () =>
      navegacion.filter((enlace) => {
        if (enlace.seccion && !esVisible(enlace.seccion)) return false;
        if (enlace.soloConEgresados && egresados.total === 0) return false;
        return true;
      }),
    [esVisible, egresados.total],
  );

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
            {enlaces.map((item) => (
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
            {/*
              El WhatsApp es el canal por el que la academia atiende de verdad, y
              faltaba acá: estaba cargado en el panel y el pie no lo mostraba en
              ningún lado. El enlace se arma con las mismas reglas que el resto
              del sitio, así que no aparece si el número no sirve.
            */}
            {wa && negocio.whatsapp && (
              <li className="flex items-start gap-2">
                <MessageCircle
                  size={16}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-marca-500"
                />
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-white"
                >
                  {negocio.whatsapp}
                  <span className="sr-only"> (escribir por WhatsApp)</span>
                </a>
              </li>
            )}
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
