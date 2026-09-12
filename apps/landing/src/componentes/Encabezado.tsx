import { useState } from 'react';
import { academia } from '../contenido';

const enlaces = [
  { texto: 'Clases', destino: '#servicios' },
  { texto: 'Cómo funciona', destino: '#proceso' },
  { texto: 'Trámite', destino: '#tramite' },
  { texto: 'Preguntas', destino: '#preguntas' },
  { texto: 'Contacto', destino: '#contacto' },
];

export function Encabezado() {
  const [abierto, setAbierto] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"
        aria-label="Navegación principal"
      >
        <a href="#inicio" className="text-lg font-bold text-marca-900">
          {academia.nombreCorto}
          <span className="ml-2 hidden text-sm font-normal text-slate-500 sm:inline">
            Academia de Choferes
          </span>
        </a>

        <ul className="hidden items-center gap-6 md:flex">
          {enlaces.map((enlace) => (
            <li key={enlace.destino}>
              <a
                href={enlace.destino}
                className="text-sm text-slate-600 transition hover:text-marca-600"
              >
                {enlace.texto}
              </a>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 md:hidden"
          aria-expanded={abierto}
          aria-controls="menu-movil"
          onClick={() => setAbierto((valor) => !valor)}
        >
          <span className="sr-only">{abierto ? 'Cerrar menú' : 'Abrir menú'}</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d={abierto ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </nav>

      {abierto && (
        <ul id="menu-movil" className="border-t border-slate-200 px-4 py-2 md:hidden">
          {enlaces.map((enlace) => (
            <li key={enlace.destino}>
              <a
                href={enlace.destino}
                className="block py-2.5 text-slate-700"
                onClick={() => setAbierto(false)}
              >
                {enlace.texto}
              </a>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
