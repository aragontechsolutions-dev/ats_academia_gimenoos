import { useEffect, useState } from 'react';
import { Menu, MessageCircle, X } from 'lucide-react';

import { navegacion, negocio } from '../contenido';
import { enlaceWhatsApp, destinoPrincipal } from '../lib/whatsapp';
import { clasesBoton } from './ui/Boton';

/**
 * Navegación fija.
 *
 * Arranca transparente sobre el hero oscuro y se vuelve sólida al bajar: así el
 * hero se ve completo al entrar, y después la navegación sigue legible sobre el
 * contenido claro.
 */
export function Encabezado() {
  const [bajado, setBajado] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const wa = enlaceWhatsApp();
  const principal = destinoPrincipal();

  useEffect(() => {
    const alDesplazar = () => setBajado(window.scrollY > 24);
    alDesplazar();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => window.removeEventListener('scroll', alDesplazar);
  }, []);

  // Escape cierra el menú: quien navega con teclado tiene que poder salir sin
  // buscar el botón de cerrar.
  useEffect(() => {
    if (!menuAbierto) return;
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMenuAbierto(false);
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [menuAbierto]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        bajado || menuAbierto ? 'bg-carbon-950/95 shadow-lg backdrop-blur' : 'bg-transparent'
      }`}
    >
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4"
        aria-label="Navegación principal"
      >
        <a href="#inicio" className="flex items-baseline gap-1 text-xl font-extrabold tracking-tight text-white">
          {negocio.nombreCorto}
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-marca-500" />
        </a>

        <ul className="hidden items-center gap-7 lg:flex">
          {navegacion.map((enlace) => (
            <li key={enlace.destino}>
              <a
                href={enlace.destino}
                className="text-sm font-medium text-slate-200 transition hover:text-acento-400"
              >
                {enlace.texto}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a
            href={principal.href}
            {...(principal.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={`${clasesBoton('primario')} hidden !px-5 !py-2.5 !text-sm sm:inline-flex`}
          >
            {wa && <MessageCircle size={18} aria-hidden="true" />}
            Consultar
          </a>

          <button
            type="button"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            aria-expanded={menuAbierto}
            aria-controls="menu-movil"
            className="rounded-lg p-2 text-white lg:hidden"
          >
            <span className="sr-only">{menuAbierto ? 'Cerrar menú' : 'Abrir menú'}</span>
            {menuAbierto ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {menuAbierto && (
        /* Fondo sólido, no translúcido: sobre las tarjetas claras de la página
           el menú con transparencia se vuelve difícil de leer. */
        <div id="menu-movil" className="border-t border-white/10 bg-carbon-950 lg:hidden">
          <ul className="mx-auto max-w-6xl px-4 py-2">
            {navegacion.map((enlace) => (
              <li key={enlace.destino}>
                <a
                  href={enlace.destino}
                  onClick={() => setMenuAbierto(false)}
                  className="block py-3 font-medium text-slate-200"
                >
                  {enlace.texto}
                </a>
              </li>
            ))}
            <li className="py-3">
              <a
                href={principal.href}
                {...(principal.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                onClick={() => setMenuAbierto(false)}
                className={`${clasesBoton('primario')} w-full`}
              >
                Consultar
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
