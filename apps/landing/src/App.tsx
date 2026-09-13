import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

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
import { Graduados } from './componentes/Graduados';
import { Testimonios } from './componentes/Testimonios';
import { Galeria } from './componentes/Galeria';
import { Ubicacion } from './componentes/Ubicacion';
import { Preguntas } from './componentes/Preguntas';
import { Contacto } from './componentes/Contacto';
import { CtaFinal } from './componentes/CtaFinal';
import { PieDePagina } from './componentes/PieDePagina';
import { BotonWhatsApp } from './componentes/BotonWhatsApp';
import { PaginaGraduadosPublica } from './paginas/Graduados';
import { PaginaDiploma } from './paginas/Diploma';
import { observarEntradas } from './lib/animacion';
import { ProveedorContenido, useOrdenSecciones } from './contexto/ContenidoContexto';
import { SECCIONES_DEL_SITIO, ordenPorDefectoSeccion } from './lib/secciones';

/**
 * Qué componente dibuja cada sección.
 *
 * El ORDEN no está acá: lo define la lista compartida con la API. Tener el orden
 * en dos lados fue un error que ya costó un bug —el formulario de contacto
 * apareció antes que las preguntas frecuentes—, así que este mapa solo dice qué
 * pinta cada clave.
 *
 * Como la lista viene de un JSON, TypeScript no puede verificar que estén todas
 * las claves: un JSON importado se tipa como `string`, no como la unión de sus
 * valores. La comprobación se hace abajo, al cargar el módulo, y en producción
 * una sección sin componente se saltea en vez de romper la página.
 */
const COMPONENTES: Record<string, ReactNode> = {
  beneficios: <BarraConfianza />,
  porQue: <PorQue />,
  modalidades: <Modalidades />,
  proceso: <Proceso />,
  vehiculos: <Vehiculos />,
  planes: <Planes />,
  tramite: <Tramite />,
  instructores: <Instructores />,
  graduados: <Graduados />,
  testimonios: <Testimonios />,
  galeria: <Galeria />,
  ubicacion: <Ubicacion />,
  preguntas: <Preguntas />,
  contacto: <Contacto />,
};

// Si alguien agrega una sección a la lista compartida y no escribe su
// componente, se ve acá y no en producción.
if (import.meta.env.DEV) {
  const faltantes = SECCIONES_DEL_SITIO.filter((clave) => !(clave in COMPONENTES));
  if (faltantes.length > 0) {
    console.error(
      `Hay secciones sin componente en App.tsx: ${faltantes.join(', ')}. ` +
        'Agregalas a COMPONENTES o marcalas con enElSitio: false en ' +
        'packages/shared/secciones-landing.json.',
    );
  }
}

/**
 * Cada sección decide sola si se dibuja: las que dependen de datos reales
 * (vehículos, instructores, egresados, testimonios, galería) devuelven null
 * mientras no haya contenido, y todas devuelven null si se las ocultó.
 */
function Secciones() {
  const orden = useOrdenSecciones();

  // La API devuelve el orden de TODAS las secciones, así que o vienen todas o no
  // viene ninguna (API caída). Si no viene, se cae a la posición por defecto de
  // la lista compartida, que es la misma que usa la API: nunca se mezclan dos
  // numeraciones distintas.
  const ordenadas = SECCIONES_DEL_SITIO.filter((clave) => clave in COMPONENTES)
    .map((clave) => ({
      clave,
      elemento: COMPONENTES[clave],
      posicion: orden[clave] ?? ordenPorDefectoSeccion(clave),
    }))
    .sort((a, b) => a.posicion - b.posicion);

  return (
    <>
      {ordenadas.map((seccion) => (
        <div key={seccion.clave}>{seccion.elemento}</div>
      ))}
    </>
  );
}

function Portada() {
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
    </>
  );
}

/** Las páginas aparte comparten el pie y el botón flotante con la portada. */
function ConPie({ children }: { children: ReactNode }) {
  useEffect(() => observarEntradas(), []);
  return (
    <>
      {children}
      <PieDePagina />
      <BotonWhatsApp />
    </>
  );
}

export function App() {
  return (
    <ProveedorContenido>
      <BrowserRouter>
        <Routes>
          <Route
            path="/graduados"
            element={
              <ConPie>
                <PaginaGraduadosPublica />
              </ConPie>
            }
          />
          <Route
            path="/diploma"
            element={
              <ConPie>
                <PaginaDiploma />
              </ConPie>
            }
          />
          {/* Cualquier otra ruta cae en la portada: es un sitio público, y una
              pantalla de "no encontrado" solo sirve para perder una visita. */}
          <Route
            path="*"
            element={
              <>
                <Portada />
                <PieDePagina />
                <BotonWhatsApp />
              </>
            }
          />
        </Routes>
      </BrowserRouter>
    </ProveedorContenido>
  );
}
