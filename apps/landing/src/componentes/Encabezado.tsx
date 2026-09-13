import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Menu, MessageCircle, X } from 'lucide-react';

import { navegacion } from '../contenido';
import {
  useEnlaceWhatsApp,
  useDestinoPrincipal,
  useNegocio,
  useSeccionVisible,
} from '../contexto/ContenidoContexto';
import { useEgresados } from '../lib/egresados';
import { useSeccionActiva } from '../lib/seccionActiva';
import { esAtajoDePanel, urlIngresoPanel } from '../lib/panel';
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
  const negocio = useNegocio();
  const wa = useEnlaceWhatsApp();
  const principal = useDestinoPrincipal();

  const esVisible = useSeccionVisible();
  const egresados = useEgresados();

  /**
   * Solo los enlaces que llevan a algo.
   *
   * Una sección que la academia ocultó desde el panel, o una que se esconde sola
   * por no tener contenido —la de egresados, mientras no haya ninguno
   * publicado—, no dibuja su ancla. El enlace quedaría apuntando a un `#` que no
   * existe y el navegador dejaría a la persona donde estaba, sin ningún aviso.
   */
  const enlaces = useMemo(
    () =>
      navegacion.filter((enlace) => {
        if (enlace.seccion && !esVisible(enlace.seccion)) return false;
        if (enlace.soloConEgresados && egresados.total === 0) return false;
        return true;
      }),
    [esVisible, egresados.total],
  );

  // El hook recibe un array; useMemo evita volver a suscribir el listener en
  // cada render.
  const destinos = useMemo(() => enlaces.map((enlace) => enlace.destino), [enlaces]);
  const activa = useSeccionActiva(destinos);

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
    const alPresionar = (evento: globalThis.KeyboardEvent) => {
      if (evento.key === 'Escape') setMenuAbierto(false);
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [menuAbierto]);

  /**
   * Atajo del personal: Ctrl + Shift + clic en el logo abre el ingreso al panel.
   * Sin esa combinación el logo se comporta como siempre y lleva al inicio.
   * Ver `lib/panel.ts`: esto es discreción, no un control de seguridad.
   */
  const abrirPanel = () => {
    window.open(urlIngresoPanel(), '_blank', 'noopener,noreferrer');
  };

  const alHacerClicEnLogo = (evento: MouseEvent<HTMLAnchorElement>) => {
    if (!esAtajoDePanel(evento)) return;
    evento.preventDefault();
    abrirPanel();
  };

  // Con teclado no existe el "clic con modificadores": quien navega así llega al
  // logo con Tab y usa la misma combinación sobre Enter.
  const alPresionarEnLogo = (evento: KeyboardEvent<HTMLAnchorElement>) => {
    if (evento.key !== 'Enter' || !esAtajoDePanel(evento)) return;
    evento.preventDefault();
    abrirPanel();
  };

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
        <a
          href="#inicio"
          onClick={alHacerClicEnLogo}
          onKeyDown={alPresionarEnLogo}
          className="flex items-baseline gap-1 text-xl font-extrabold tracking-tight text-white"
        >
          {negocio.nombreCorto}
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-marca-500" />
        </a>

        <ul className="hidden items-center gap-7 lg:flex">
          {enlaces.map((enlace) => {
            const esActiva = activa === enlace.destino;
            return (
              <li key={enlace.destino}>
                <a
                  href={enlace.destino}
                  aria-current={esActiva ? 'true' : undefined}
                  className={`relative block py-1 text-sm font-medium transition ${
                    esActiva ? 'text-white' : 'text-slate-200 hover:text-acento-400'
                  }`}
                >
                  {enlace.texto}
                  {/* La barrita se renderiza siempre y se escala: así la
                      transición se ve, en vez de aparecer de golpe. */}
                  <span
                    aria-hidden="true"
                    className={`absolute -bottom-0.5 left-0 h-0.5 w-full origin-left rounded-full bg-acento-400 transition-transform duration-300 ${
                      esActiva ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </a>
              </li>
            );
          })}
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
            {enlaces.map((enlace) => {
              const esActiva = activa === enlace.destino;
              return (
                <li key={enlace.destino}>
                  <a
                    href={enlace.destino}
                    onClick={() => setMenuAbierto(false)}
                    aria-current={esActiva ? 'true' : undefined}
                    className={`flex items-center gap-3 border-l-2 py-3 pl-3 font-medium transition ${
                      esActiva
                        ? 'border-acento-400 text-white'
                        : 'border-transparent text-slate-200'
                    }`}
                  >
                    {enlace.texto}
                  </a>
                </li>
              );
            })}
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
