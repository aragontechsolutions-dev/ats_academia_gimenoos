import { Encabezado } from './componentes/Encabezado';
import { Hero } from './componentes/Hero';
import { Categorias } from './componentes/Categorias';
import { Servicios } from './componentes/Servicios';
import { Proceso } from './componentes/Proceso';
import { Tramite } from './componentes/Tramite';
import { Instructores } from './componentes/Instructores';
import { Testimonios } from './componentes/Testimonios';
import { Preguntas } from './componentes/Preguntas';
import { Contacto } from './componentes/Contacto';
import { PieDePagina } from './componentes/PieDePagina';
import { BotonWhatsApp } from './componentes/BotonWhatsApp';

export function App() {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-marca-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>
      <Encabezado />
      <main id="contenido">
        <Hero />
        <Categorias />
        <Servicios />
        <Proceso />
        <Tramite />
        <Instructores />
        <Testimonios />
        <Preguntas />
        <Contacto />
      </main>
      <PieDePagina />
      <BotonWhatsApp />
    </>
  );
}
