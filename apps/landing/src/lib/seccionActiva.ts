import { useEffect, useState } from 'react';

/**
 * Altura de la barra fija. Tiene que coincidir con `scroll-padding-top` del
 * `html` (5rem en index.css): es la línea por debajo de la cual empieza lo que
 * la persona realmente está mirando.
 */
const ALTO_BARRA = 80;

/** Margen extra para que la sección se marque justo cuando su título asoma. */
const HOLGURA = 8;

/**
 * Devuelve cuál de los destinos de navegación está en pantalla.
 *
 * Se calcula mirando la posición de cada sección y no con un IntersectionObserver
 * porque acá la pregunta no es "¿esta sección se ve?" sino "¿en cuál estoy?", que
 * son cosas distintas: con dos secciones visibles a la vez el observador marcaría
 * las dos, y en una sección más alta que la pantalla no marcaría ninguna.
 *
 * La regla es simple: la sección activa es la última cuyo borde superior ya pasó
 * por debajo de la barra.
 */
export function useSeccionActiva(destinos: readonly string[]): string | null {
  const [activa, setActiva] = useState<string | null>(null);

  useEffect(() => {
    let pendiente = false;

    const calcular = () => {
      pendiente = false;

      const limite = ALTO_BARRA + HOLGURA;
      let encontrada: string | null = null;
      let mejorTop = -Infinity;

      // Se busca la sección más cercana a la línea entre las que ya la pasaron,
      // comparando posiciones y NO el orden del menú: el menú no tiene por qué
      // estar ordenado igual que la página, y cuando no lo está —pasó— recorrer
      // el array en orden marca la sección equivocada.
      for (const destino of destinos) {
        const elemento = document.querySelector(destino);
        if (!elemento) continue;
        const top = elemento.getBoundingClientRect().top;
        if (top <= limite && top > mejorTop) {
          mejorTop = top;
          encontrada = destino;
        }
      }

      // Al final de la página la última sección puede ser demasiado baja para
      // llegar nunca al límite. Si ya no se puede bajar más, es esa.
      const fondo =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (fondo) {
        let masBaja: string | null = null;
        let tope = -Infinity;
        for (const destino of destinos) {
          const elemento = document.querySelector(destino);
          if (!elemento) continue;
          const top = elemento.getBoundingClientRect().top;
          if (top > tope) {
            tope = top;
            masBaja = destino;
          }
        }
        if (masBaja) encontrada = masBaja;
      }

      setActiva(encontrada);
    };

    // El scroll dispara muchas veces por segundo: se agrupa en un solo cálculo
    // por cuadro para no hacer trabajo de layout que nadie va a ver.
    const alDesplazar = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(calcular);
    };

    calcular();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', alDesplazar);
    return () => {
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('resize', alDesplazar);
    };
  }, [destinos]);

  return activa;
}
