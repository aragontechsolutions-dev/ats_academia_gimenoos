import { useEffect, type ReactNode } from 'react';
import { Encabezado } from './componentes/Encabezado';
import { Hero } from './componentes/Hero';
import { BarraConfianza } from './componentes/BarraConfianza';
import { PorQue } from './componentes/PorQue';
import { Modalidades } from './componentes/Modalidades';
import { Proceso } from './componentes/Proceso';
import { Vehiculos } from './componentes/Vehiculos';
import { Planes } from './componentes/Planes';
import { Tramite } from './componentes/Tramite';
import { Instructores } from './componentes/Instructores';
import { Testimonios } from './componentes/Testimonios';
import { Galeria } from './componentes/Galeria';
import { Ubicacion } from './componentes/Ubicacion';
import { Preguntas } from './componentes/Preguntas';
import { Contacto } from './componentes/Contacto';
import { CtaFinal } from './componentes/CtaFinal';
import { PieDePagina } from './componentes/PieDePagina';
import { BotonWhatsApp } from './componentes/BotonWhatsApp';
import { observarEntradas } from './lib/animacion';
import { ProveedorContenido, useOrdenSecciones } from './contexto/ContenidoContexto';

/**
 * Secciones de contenido, en su orden por defecto.
 *
 * El hero va aparte y siempre primero: es la apertura de la página, no una
 * sección más. El resto se puede reordenar desde el panel.
 */
const SECCIONES: Array<{ clave: string; elemento: ReactNode }> = [
  { clave: 'beneficios', elemento: <BarraConfianza /> },
  { clave: 'porQue', elemento: <PorQue /> },
  { clave: 'modalidades', elemento: <Modalidades /> },
  { clave: 'proceso', elemento: <Proceso /> },
  { clave: 'vehiculos', elemento: <Vehiculos /> },
  { clave: 'planes', elemento: <Planes /> },
  { clave: 'tramite', elemento: <Tramite /> },
  { clave: 'instructores', elemento: <Instructores /> },
  { clave: 'testimonios', elemento: <Testimonios /> },
  { clave: 'galeria', elemento: <Galeria /> },
  { clave: 'ubicacion', elemento: <Ubicacion /> },
  { clave: 'preguntas', elemento: <Preguntas /> },
  { clave: 'contacto', elemento: <Contacto /> },
];

/**
 * Cada sección decide sola si se dibuja: las que dependen de fotos reales
 * (vehículos, instructores, testimonios, galería) devuelven null mientras no
 * haya datos cargados, y todas devuelven null si se las ocultó desde el panel.
 */
function Secciones() {
  const orden = useOrdenSecciones();

  // La API devuelve el orden de TODAS las secciones, así que o vienen todas o no
  // viene ninguna (API caída). Por eso alcanza con caer a la posición de esta
  // lista: nunca se mezclan las dos numeraciones. Esta lista tiene que quedar en
  // el mismo orden que SECCIONES_LANDING en la API.
  const ordenadas = SECCIONES.map((seccion, indice) => ({
    ...seccion,
    posicion: orden[seccion.clave] ?? indice,
  })).sort((a, b) => a.posicion - b.posicion);

  return (
    <>
      {ordenadas.map((seccion) => (
        <div key={seccion.clave}>{seccion.elemento}</div>
      ))}
    </>
  );
}

function Pagina() {
  // Se vuelve a observar cuando cambia el contenido remoto: las secciones que
  // llegan después del primer render traen bloques animados que, sin esto,
  // nacerían invisibles.
  useEffect(() => observarEntradas(), []);

  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-marca-500 focus:px-4 focus:py-2 focus:font-bold focus:text-white"
      >
        Saltar al contenido
      </a>
      <Encabezado />
      <main id="contenido">
        <Hero />
        <Secciones />
        <CtaFinal />
      </main>
      <PieDePagina />
      <BotonWhatsApp />
    </>
  );
}

export function App() {
  return (
    <ProveedorContenido>
      <Pagina />
    </ProveedorContenido>
  );
}
