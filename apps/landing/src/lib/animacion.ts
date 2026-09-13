/**
 * Activa las entradas suaves al entrar en pantalla.
 *
 * Se usa un IntersectionObserver y no una animación permanente porque así el
 * elemento se anima una sola vez y después queda quieto: el movimiento continuo
 * en una página de contenido cansa y distrae del objetivo, que es contactar.
 *
 * El MutationObserver acompaña al anterior por una razón concreta: los planes
 * llegan por fetch y se montan después de este efecto. Sin él, las tarjetas de
 * precios nacerían con `opacity: 0` y nadie las vería nunca.
 */
export function observarEntradas(): () => void {
  // Si el navegador no lo soporta, se muestra todo: nunca contenido invisible.
  if (typeof IntersectionObserver === 'undefined') {
    document
      .querySelectorAll<HTMLElement>('.aparece')
      .forEach((elemento) => elemento.classList.add('visible'));
    return () => {};
  }

  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('visible');
          observador.unobserve(entrada.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
  );

  const registrar = (raiz: ParentNode) => {
    raiz.querySelectorAll<HTMLElement>('.aparece:not(.visible)').forEach((elemento) => {
      observador.observe(elemento);
    });
  };

  registrar(document);

  if (typeof MutationObserver === 'undefined') {
    return () => observador.disconnect();
  }

  const vigilante = new MutationObserver((mutaciones) => {
    for (const mutacion of mutaciones) {
      for (const nodo of mutacion.addedNodes) {
        if (!(nodo instanceof HTMLElement)) continue;
        if (nodo.classList.contains('aparece')) observador.observe(nodo);
        registrar(nodo);
      }
    }
  });

  vigilante.observe(document.body, { childList: true, subtree: true });

  return () => {
    vigilante.disconnect();
    observador.disconnect();
  };
}
