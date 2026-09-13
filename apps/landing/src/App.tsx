import { useEffect } from 'react';
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
import { Contacto } from './componentes/Contacto';
import { Preguntas } from './componentes/Preguntas';
import { CtaFinal } from './componentes/CtaFinal';
import { PieDePagina } from './componentes/PieDePagina';
import { BotonWhatsApp } from './componentes/BotonWhatsApp';
import { observarEntradas } from './lib/animacion';

/**
 * Orden de la página: primero convencer, después informar, y el precio recién
 * cuando ya se entendió qué se está comprando.
 *
 * Vehiculos, Instructores, Testimonios y Galeria se renderizan solas o no según
 * haya datos reales cargados: no hay secciones vacías ni contenido de relleno.
 */
export function App() {
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
        <BarraConfianza />
        <PorQue />
        <Modalidades />
        <Proceso />
        <Vehiculos />
        <Planes />
        <Tramite />
        <Instructores />
        <Testimonios />
        <Galeria />
        <Ubicacion />
        <Contacto />
        <Preguntas />
        <CtaFinal />
      </main>
      <PieDePagina />
      <BotonWhatsApp />
    </>
  );
}
