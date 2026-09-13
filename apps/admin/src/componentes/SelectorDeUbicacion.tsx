import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  DECIMALES_COORDENADA,
  MARCADOR,
  TESELAS_OSM,
  coordenadasDe,
  redondearCoordenada,
  svgDelMarcador,
  type Coordenadas,
} from '@gimenoos/shared';

import { Aviso } from './ui/Aviso';

/**
 * Vista de arranque cuando todavía no hay nada marcado: el país entero.
 *
 * A propósito NO es una dirección concreta. Un punto de partida preciso se
 * confunde con «la ubicación guardada», y alguien podría guardar esa sin
 * haberla movido. Desde acá se llega al local con «Usar mi ubicación», que es
 * un toque, o buscando a mano.
 */
const VISTA_INICIAL = { centro: [-32.8, -55.8] as [number, number], zoom: 6 };

/** Zoom al que se salta cuando aparece un punto: se ven las calles. */
const ZOOM_DE_CALLE = 17;

/** Lo que se le da al aparato para conseguir la señal. */
const ESPERA_GEOLOCALIZACION_MS = 10_000;

/**
 * Hasta cuándo se espera una respuesta, contando desde el clic.
 *
 * Es un reloj NUESTRO, además del que acepta `getCurrentPosition`. Hace falta:
 * el de la especificación empieza a correr recién DESPUÉS de que se concede el
 * permiso, así que mientras el aviso del navegador sigue sin responder no vence
 * nunca. Comprobado en un navegador de verdad: sin esto, el botón se queda en
 * «Buscando…» para siempre.
 */
const ESPERA_TOTAL_MS = 12_000;

const SIN_PERMISO =
  'El navegador tiene bloqueado el permiso de ubicación para esta página. Se habilita desde el ' +
  'candado de la barra de direcciones. Si no, marcá el punto tocando el mapa.';

const SIN_RESPUESTA =
  'El navegador no contestó. Suele pasar cuando el aviso que pide permiso para usar la ubicación ' +
  'quedó sin responder: fijate si aparece arriba, o usá el candado de la barra de direcciones. ' +
  'También podés marcar el punto tocando el mapa.';

/**
 * Elige el punto del local sobre un mapa.
 *
 * Se marca tocando el mapa, arrastrando el marcador, o con «Usar mi ubicación»
 * si quien configura está parado en la academia. Escribir coordenadas a mano no
 * es una opción que se ofrezca: nadie sabe de memoria su latitud, y un número
 * mal tecleado manda a los alumnos a otra ciudad sin que nada lo delate.
 *
 * El componente NO guarda: avisa del cambio y el formulario que lo contiene
 * decide. Así el mapa se comporta como cualquier otro campo del formulario.
 */
export function SelectorDeUbicacion({
  valor,
  onCambio,
}: {
  valor: Coordenadas | null;
  onCambio: (punto: Coordenadas | null) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const marcadorRef = useRef<L.Marker | null>(null);
  /**
   * El aviso que ve quien configura. Solo para lo que sale mal al pedir la
   * ubicación: lo demás se explica solo mirando el mapa.
   */
  const [aviso, setAviso] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  /** El reloj propio, para poder pararlo si se desmonta a mitad de la espera. */
  const relojRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (relojRef.current !== null) window.clearTimeout(relojRef.current);
    },
    [],
  );

  /**
   * `onCambio` en una ref y no en las dependencias del efecto.
   *
   * El formulario que contiene esto la redefine en cada render. Si el efecto
   * dependiera de ella, el mapa se destruiría y se volvería a crear con cada
   * tecla que se escriba en cualquier otro campo.
   */
  const alCambiar = useRef(onCambio);
  alCambiar.current = onCambio;

  // El mapa se crea UNA vez. Mover el punto después no lo vuelve a construir:
  // eso reiniciaría el zoom y el encuadre que la persona acomodó a mano.
  useEffect(() => {
    const elemento = contenedor.current;
    if (!elemento) return;

    const mapa = L.map(elemento, {
      center: valor ? [valor.latitud, valor.longitud] : VISTA_INICIAL.centro,
      zoom: valor ? ZOOM_DE_CALLE : VISTA_INICIAL.zoom,
    });
    mapaRef.current = mapa;

    L.tileLayer(TESELAS_OSM.url, {
      attribution: TESELAS_OSM.atribucion,
      maxZoom: TESELAS_OSM.zoomMaximo,
    }).addTo(mapa);

    mapa.on('click', (evento: L.LeafletMouseEvent) => {
      alCambiar.current({
        latitud: redondearCoordenada(evento.latlng.lat),
        longitud: redondearCoordenada(evento.latlng.lng),
      });
    });

    const cuadro = requestAnimationFrame(() => mapa.invalidateSize());

    return () => {
      cancelAnimationFrame(cuadro);
      mapa.remove();
      mapaRef.current = null;
      marcadorRef.current = null;
    };
    // Solo al montar: `valor` se usa acá para el encuadre inicial y después lo
    // atiende el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El marcador sigue al valor, venga de donde venga: un clic en el mapa, el
  // botón de «usar mi ubicación», o los datos que se cargaron del servidor.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    if (!valor) {
      marcadorRef.current?.remove();
      marcadorRef.current = null;
      return;
    }

    const posicion: L.LatLngExpression = [valor.latitud, valor.longitud];

    if (!marcadorRef.current) {
      const marcador = L.marker(posicion, {
        draggable: true,
        icon: L.divIcon({
          html: svgDelMarcador(),
          className: '',
          iconSize: [MARCADOR.ancho, MARCADOR.alto],
          // La punta señala el lugar, no el centro del dibujo.
          iconAnchor: [MARCADOR.ancho / 2, MARCADOR.alto],
        }),
        title: 'Arrastralo para corregir el punto',
      }).addTo(mapa);

      marcador.on('dragend', () => {
        const donde = marcador.getLatLng();
        alCambiar.current({
          latitud: redondearCoordenada(donde.lat),
          longitud: redondearCoordenada(donde.lng),
        });
      });

      marcadorRef.current = marcador;
      mapa.setView(posicion, Math.max(mapa.getZoom(), ZOOM_DE_CALLE));
    } else {
      marcadorRef.current.setLatLng(posicion);
    }
  }, [valor]);

  const usarMiUbicacion = async () => {
    setAviso(null);

    if (!navigator.geolocation) {
      setAviso('Este navegador no puede dar la ubicación. Marcá el punto tocando el mapa.');
      return;
    }

    // Se pregunta por el permiso ANTES de pedir la ubicación.
    //
    // Con el permiso bloqueado, Chrome no llama a ninguna de las dos funciones:
    // ni a la de éxito ni a la de error. Sin esto, quien lo tenga bloqueado se
    // queda diez segundos mirando «Buscando…» y después recibe un mensaje sobre
    // el tiempo de espera, que no dice nada del problema real.
    if (navigator.permissions?.query) {
      try {
        const permiso = await navigator.permissions.query({ name: 'geolocation' });
        if (permiso.state === 'denied') {
          setAviso(SIN_PERMISO);
          return;
        }
      } catch {
        // Hay navegadores que no saben consultar este permiso. No es un
        // problema: se sigue y se pide la ubicación como siempre.
      }
    }

    setBuscando(true);

    // Solo la PRIMERA respuesta cuenta, venga del navegador o del reloj.
    let contestado = false;
    const responder = (accion: () => void) => {
      if (contestado) return;
      contestado = true;
      window.clearTimeout(relojRef.current ?? undefined);
      relojRef.current = null;
      setBuscando(false);
      accion();
    };

    relojRef.current = window.setTimeout(() => responder(() => setAviso(SIN_RESPUESTA)), ESPERA_TOTAL_MS);

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        responder(() =>
          onCambio({
            latitud: redondearCoordenada(posicion.coords.latitude),
            longitud: redondearCoordenada(posicion.coords.longitude),
          }),
        );
      },
      (problema) => {
        // Cada caso se dice distinto porque cada uno se arregla distinto: uno
        // es un permiso, otro es el aparato, otro es esperar y reintentar.
        const mensaje =
          problema.code === problema.PERMISSION_DENIED
            ? SIN_PERMISO
            : problema.code === problema.TIMEOUT
              ? 'El aparato no consiguió la señal a tiempo. Probá de nuevo, o marcá el punto tocando el mapa.'
              : 'No se pudo obtener la ubicación. Marcá el punto tocando el mapa.';
        responder(() => setAviso(mensaje));
      },
      { enableHighAccuracy: true, timeout: ESPERA_GEOLOCALIZACION_MS },
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void usarMiUbicacion()}
          disabled={buscando}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {buscando ? 'Buscando…' : 'Usar mi ubicación'}
        </button>

        {valor && (
          <button
            type="button"
            onClick={() => {
              setAviso(null);
              onCambio(null);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Quitar del mapa
          </button>
        )}

        <p className="text-sm text-slate-600">
          {valor ? (
            <>
              <span className="sr-only">Punto marcado en </span>
              <span className="font-mono">
                {valor.latitud.toFixed(DECIMALES_COORDENADA)},{' '}
                {valor.longitud.toFixed(DECIMALES_COORDENADA)}
              </span>
            </>
          ) : (
            'Todavía sin marcar. Tocá el mapa donde está la academia.'
          )}
        </p>
      </div>

      {aviso && (
        <div className="mt-3">
          <Aviso>{aviso}</Aviso>
        </div>
      )}

      <div
        ref={contenedor}
        role="application"
        aria-label="Mapa para marcar la ubicación de la academia"
        className="mt-3 h-80 w-full rounded-xl border border-slate-300"
      />

      <p className="mt-2 text-xs text-slate-500">
        Tocá el mapa para marcar el punto, o arrastrá el marcador para corregirlo. Se guarda con el
        botón de abajo, junto con el resto de los datos de contacto.
      </p>
    </div>
  );
}

/** Las coordenadas de un negocio, listas para el selector. */
export function coordenadasDelNegocio(negocio: {
  latitud: number | null;
  longitud: number | null;
}): Coordenadas | null {
  return coordenadasDe(negocio.latitud, negocio.longitud);
}
