import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Velocidad del vaivén, en píxeles por segundo.
 *
 * Veinticinco es deliberadamente lento: la idea es que se note que hay más
 * fotos, no que desfilen. Más rápido se lee como una animación publicitaria y
 * marea a quien está intentando mirar una cara.
 */
const VELOCIDAD = 25;

/**
 * Tope del salto de tiempo entre cuadros.
 *
 * Una pestaña en segundo plano deja de recibir cuadros; al volver, el primero
 * llega con varios segundos acumulados y, sin este tope, el carrusel pegaría un
 * salto de media pista.
 */
const SALTO_MAXIMO_MS = 50;

/** Si el sistema pide menos movimiento. Se escucha, porque puede cambiar. */
function usaMenosMovimiento(): boolean {
  const [menos, setMenos] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    const consulta = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!consulta) return;
    const escuchar = (evento: MediaQueryListEvent) => setMenos(evento.matches);
    consulta.addEventListener('change', escuchar);
    return () => consulta.removeEventListener('change', escuchar);
  }, []);
  return menos;
}

/**
 * Una fila de tarjetas que se desliza sola, de ida y de vuelta.
 *
 * Tres reglas que no son estéticas:
 *
 * 1. **Solo se mueve si no entra.** Si las fotos caben en el ancho disponible,
 *    quedan quietas: mover algo que ya se ve entero es ruido. Se mide con un
 *    `ResizeObserver`, porque el ancho cambia al rotar el teléfono.
 * 2. **Se frena cuando alguien lo está mirando.** Al pasar el mouse, al entrar
 *    con el teclado o al tocar la pantalla. Una fila que se corre justo cuando
 *    vas a tocar una foto es una trampa, no una animación.
 * 3. **Respeta `prefers-reduced-motion`.** Quien pidió menos movimiento en su
 *    sistema no lo pidió para otros sitios: el carrusel queda quieto y se maneja
 *    con las flechas.
 *
 * El desplazamiento se lleva en una variable propia y no se lee de `scrollLeft`
 * en cada cuadro: el navegador lo redondea a enteros, y a esta velocidad eso
 * significa avanzar de a saltos visibles en vez de suavemente.
 */
export function Carrusel({ children, etiqueta }: { children: ReactNode; etiqueta: string }) {
  const pista = useRef<HTMLUListElement>(null);
  const [desborda, setDesborda] = useState(false);
  const [quieto, setQuieto] = useState(false);
  const menosMovimiento = usaMenosMovimiento();

  // ¿Las tarjetas entran en el ancho disponible?
  useEffect(() => {
    const nodo = pista.current;
    if (!nodo) return;
    // El +1 evita que un redondeo de medio píxel haga creer que desborda.
    const medir = () => setDesborda(nodo.scrollWidth > nodo.clientWidth + 1);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [children]);

  // El vaivén.
  useEffect(() => {
    const nodo = pista.current;
    if (!nodo || !desborda || quieto || menosMovimiento) return;

    // Se arranca de donde el nodo esté de verdad: si quien mira lo movió a mano,
    // el movimiento sigue desde ahí y no da un salto al reanudar.
    let posicion = nodo.scrollLeft;
    let sentido: 1 | -1 = 1;
    let anterior = performance.now();
    let cuadro = 0;

    const paso = (ahora: number) => {
      const transcurrido = Math.min(ahora - anterior, SALTO_MAXIMO_MS);
      anterior = ahora;

      const maximo = nodo.scrollWidth - nodo.clientWidth;
      posicion += (sentido * VELOCIDAD * transcurrido) / 1000;

      if (posicion >= maximo) {
        posicion = maximo;
        sentido = -1;
      } else if (posicion <= 0) {
        posicion = 0;
        sentido = 1;
      }

      nodo.scrollLeft = posicion;
      cuadro = requestAnimationFrame(paso);
    };

    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [desborda, quieto, menosMovimiento]);

  /** Una pantalla de tarjetas para cada lado, con las flechas. */
  const correr = useCallback((sentido: 1 | -1) => {
    const nodo = pista.current;
    if (!nodo) return;
    nodo.scrollBy({ left: sentido * nodo.clientWidth * 0.8, behavior: 'smooth' });
  }, []);

  const flecha =
    'absolute top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-slate-200 bg-white/95 p-2 text-carbon-950 shadow-lg transition hover:border-marca-500 hover:text-marca-600 md:block';

  return (
    <div
      className="relative"
      onPointerEnter={() => setQuieto(true)}
      onPointerLeave={() => setQuieto(false)}
      onTouchStart={() => setQuieto(true)}
      onFocusCapture={() => setQuieto(true)}
      onBlurCapture={() => setQuieto(false)}
    >
      {desborda && (
        <>
          <button
            type="button"
            onClick={() => correr(-1)}
            className={`${flecha} -left-3`}
            aria-label={`Ver fotos anteriores de ${etiqueta}`}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => correr(1)}
            className={`${flecha} -right-3`}
            aria-label={`Ver más fotos de ${etiqueta}`}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </>
      )}

      <ul
        ref={pista}
        // `sin-barra` esconde la barra de desplazamiento sin impedir arrastrar
        // con el dedo. `overflow-x-auto` y no `hidden`: en el teléfono no hay
        // flechas, y el gesto natural tiene que funcionar.
        //
        // SIN `scroll-smooth`: con `scroll-behavior: smooth` en CSS, CADA
        // asignación de `scrollLeft` se anima, incluidas las sesenta por segundo
        // del vaivén, y el resultado es un temblor en vez de un deslizamiento.
        // Las flechas piden el suavizado por su cuenta, en `scrollBy`.
        className="sin-barra flex gap-5 overflow-x-auto pb-2"
      >
        {children}
      </ul>
    </div>
  );
}
