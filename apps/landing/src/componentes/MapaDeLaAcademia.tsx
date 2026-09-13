import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { MARCADOR, TESELAS_OSM, svgDelMarcador, type Coordenadas } from '@gimenoos/shared';

/** Zoom de calle: se ve la manzana y las calles de alrededor. */
const ZOOM = 16;

/**
 * El mapa con el local marcado.
 *
 * Va en un archivo aparte y se carga con `lazy`: Leaflet y su hoja de estilos
 * pesan, y esta es una página de venta donde lo que más importa es que lo
 * primero aparezca rápido. Quien nunca baja hasta «Dónde estamos» no descarga
 * nada de esto.
 *
 * Se usa Leaflet directo y no un envoltorio de React a propósito: son treinta
 * líneas de ciclo de vida y así no se suma una dependencia más que seguir
 * actualizando.
 */
export default function MapaDeLaAcademia({
  punto,
  etiqueta,
}: {
  punto: Coordenadas;
  /** Qué hay en ese punto. Se lee en el globo del marcador y con lector de pantalla. */
  etiqueta: string;
}) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elemento = contenedor.current;
    if (!elemento) return;

    const mapa = L.map(elemento, {
      center: [punto.latitud, punto.longitud],
      zoom: ZOOM,
      // La rueda del mouse NO hace zoom: en una página larga, pasar el cursor
      // por encima del mapa mientras se baja dejaría a la persona trabada
      // haciendo zoom sin haberlo pedido. Los botones + y - y el pellizco en el
      // teléfono siguen funcionando.
      scrollWheelZoom: false,
    });

    L.tileLayer(TESELAS_OSM.url, {
      attribution: TESELAS_OSM.atribucion,
      maxZoom: TESELAS_OSM.zoomMaximo,
    }).addTo(mapa);

    // El globo se arma como ELEMENTO y con `textContent`, no como cadena.
    //
    // `bindPopup` con una cadena la inserta con `innerHTML`, y esta etiqueta sale
    // del nombre y la dirección que se editan desde el panel. Pasada como texto,
    // la academia podría publicar HTML en su propio sitio público sin querer —o
    // queriendo—, que es la misma puerta que ya se cierra con los enlaces del
    // panel. Un elemento con `textContent` no tiene ese agujero.
    const globo = document.createElement('p');
    globo.className = 'm-0 font-semibold';
    globo.textContent = etiqueta;

    L.marker([punto.latitud, punto.longitud], {
      icon: L.divIcon({
        html: svgDelMarcador(),
        className: '',
        iconSize: [MARCADOR.ancho, MARCADOR.alto],
        // La punta del marcador es lo que señala el lugar, no su centro.
        iconAnchor: [MARCADOR.ancho / 2, MARCADOR.alto],
        popupAnchor: [0, -MARCADOR.alto],
      }),
      alt: etiqueta,
      keyboard: true,
      title: etiqueta,
    })
      .addTo(mapa)
      .bindPopup(globo);

    // El mapa nace dentro de un bloque que aparece con una animación. Si Leaflet
    // midió el contenedor antes de que terminara de acomodarse, quedan teselas
    // grises; esto lo obliga a medir de nuevo ya pintado.
    const cuadro = requestAnimationFrame(() => mapa.invalidateSize());

    return () => {
      cancelAnimationFrame(cuadro);
      mapa.remove();
    };
  }, [punto.latitud, punto.longitud, etiqueta]);

  return (
    <>
      {/*
        `z-0` no es decorativo: encierra al mapa en su propia pila.

        Leaflet apila sus capas internas hasta z-index 1000 —los controles de
        zoom y la atribución—, y la barra de navegación del sitio está en 50. Sin
        esto, el mapa se dibuja POR ENCIMA del menú al bajar la página. Con un
        z-index propio, todo lo de adentro queda contenido acá y esta caja
        compite con el resto como un solo bloque, en 0.
      */}
      <div
        ref={contenedor}
        role="application"
        aria-label={`Mapa con la ubicación de ${etiqueta}`}
        className="z-0 h-80 w-full rounded-2xl lg:h-[26rem]"
      />
    </>
  );
}
