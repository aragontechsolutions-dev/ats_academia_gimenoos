import type { ReactNode } from 'react';

/**
 * Envoltura de sección: mantiene el ancho, el aire y la animación de entrada
 * consistentes en toda la página, en vez de repetir las mismas clases.
 */
export function Seccion({
  id,
  children,
  className = '',
  oscura = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  oscura?: boolean;
}) {
  return (
    <section
      id={id}
      className={`${oscura ? 'bg-carbon-950 text-white' : ''} ${className}`}
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">{children}</div>
    </section>
  );
}

/**
 * Título de sección con la línea de acento que recorre toda la página.
 *
 * `nivel` existe porque el mismo componente sirve para dos cosas distintas. En
 * la portada es el título de UNA sección entre varias, debajo del `h1` del hero:
 * ahí `h2` es correcto. En una página propia —la de egresados, por ejemplo— es
 * el título de la página entera, y dejarlo en `h2` deja el documento **sin
 * ningún `h1`**: quien navega con lector de pantalla salta de encabezado en
 * encabezado y nunca encuentra de qué trata la página.
 */
export function TituloSeccion({
  sobretitulo,
  titulo,
  bajada,
  claro = false,
  nivel = 2,
}: {
  sobretitulo?: string;
  titulo: string;
  bajada?: string;
  claro?: boolean;
  nivel?: 1 | 2;
}) {
  const Titulo = nivel === 1 ? 'h1' : 'h2';
  return (
    <header className="aparece max-w-3xl">
      {sobretitulo && (
        /* Sobre fondo oscuro el sobretítulo va en amarillo, no en rojo: el rojo
           de marca sobre el negro da 3.75 de contraste y este texto es chico
           (14px), así que no llegaría al 4.5 que pide el criterio AA. En amarillo
           da 12.31. Sobre fondo claro el rojo sí cumple (5.25). */
        <p
          className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest ${
            claro ? 'text-acento-400' : 'text-marca-500'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-0.5 w-6 ${claro ? 'bg-marca-500' : 'bg-acento-400'}`}
          />
          {sobretitulo}
        </p>
      )}
      <Titulo
        className={`mt-3 text-3xl font-extrabold leading-tight sm:text-4xl ${
          claro ? 'text-white' : 'text-carbon-950'
        }`}
      >
        {titulo}
      </Titulo>
      {bajada && (
        <p className={`mt-4 text-lg ${claro ? 'text-slate-300' : 'text-slate-600'}`}>{bajada}</p>
      )}
    </header>
  );
}
