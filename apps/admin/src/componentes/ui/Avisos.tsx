import { useAvisos, type Aviso } from '../../lib/avisos';

/**
 * La pila de avisos, abajo a la izquierda.
 *
 * Abajo y no arriba: arriba está la barra de navegación y el título de cada
 * pantalla, y un aviso que aparece ahí tapa justo lo que se estaba mirando.
 * En el teléfono ocupa todo el ancho, que es la única forma de que un texto de
 * dos renglones se lea sin cortarse.
 *
 * A la IZQUIERDA en pantalla grande, y no a la derecha como es costumbre: todos
 * los modales del panel llevan Cancelar y Guardar abajo a la derecha, y ahí es
 * justo donde aparece el aviso de que un dato está mal. Tapaba el botón que hay
 * que volver a apretar después de corregirlo.
 */
export function Avisos() {
  const { avisos } = useAvisos();
  if (avisos.length === 0) return null;

  return (
    <div
      // z-[60] y no z-50: los modales están en z-50, y un aviso que aparece
      // detrás del formulario que acaba de fallar no sirve de nada.
      className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:left-4 sm:bottom-4 sm:w-96"
      aria-live="polite"
    >
      {avisos.map((aviso) => (
        <Tarjeta key={aviso.id} aviso={aviso} />
      ))}
    </div>
  );
}

function Tarjeta({ aviso }: { aviso: Aviso }) {
  const { cerrar } = useAvisos();
  const esError = aviso.tipo === 'error';

  return (
    <div
      // `alert` para los errores y `status` para lo demás: un lector de pantalla
      // interrumpe lo que está leyendo solo cuando algo salió mal.
      role={esError ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3 shadow-lg ${
        esError ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
      }`}
    >
      <Icono esError={esError} />

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${esError ? 'text-red-900' : 'text-green-900'}`}>
          {aviso.texto}
        </p>
        {aviso.detalles.length > 0 && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-red-800">
            {aviso.detalles.map((detalle) => (
              <li key={detalle}>{detalle}</li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => cerrar(aviso.id)}
        className={`shrink-0 rounded p-1 transition ${
          esError ? 'text-red-700 hover:bg-red-100' : 'text-green-700 hover:bg-green-100'
        }`}
      >
        <span aria-hidden="true">✕</span>
        <span className="sr-only">Cerrar aviso</span>
      </button>
    </div>
  );
}

function Icono({ esError }: { esError: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`mt-0.5 shrink-0 ${esError ? 'text-red-600' : 'text-green-600'}`}
    >
      {esError ? (
        <path
          d="M12 8v5M12 16.5v.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M20 6 9 17l-5-5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
