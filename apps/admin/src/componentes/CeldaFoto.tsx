import { useRef, useState } from 'react';

import { borrarFoto, subirFoto, urlFoto, type BucketFoto } from '../lib/fotos';
import { ACEPTA_INPUT, enKb } from '../lib/imagen';

interface Props {
  /** Bucket donde vive la foto. */
  bucket: BucketFoto;
  /** Id del dueño de la foto: es la carpeta dentro del bucket. */
  duenoId: string;
  /** Ruta actual, o null si todavía no tiene foto. */
  ruta: string | null;
  /** Cómo nombrar al dueño en el texto alternativo y en la confirmación. */
  descripcion: string;
  /**
   * Guarda la ruta en la base. Recibe `''` cuando se quita la foto.
   *
   * Lo hace quien usa el componente porque cada módulo tiene su propio endpoint.
   */
  guardar: (ruta: string) => Promise<unknown>;
  onCambio: () => void;
  onError: (mensaje: string) => void;
}

/**
 * Foto de una fila del panel, con subir, cambiar y quitar.
 *
 * Lo usan egresados y vehículos. El orden de las operaciones importa y es el
 * mismo en los dos casos:
 *
 *   - Al subir, primero sube la nueva y guarda su ruta, y recién DESPUÉS borra la
 *     vieja. Si algo falla en el medio, la fila se queda con su foto anterior y
 *     no sin ninguna.
 *   - Al quitar, primero borra la ruta de la base y después el archivo. Si falla
 *     el borrado del archivo, ya nadie lo referencia: queda un archivo huérfano,
 *     que es mucho menos grave que una fila apuntando a un archivo que no está.
 *
 * La validación de la imagen (extensión, peso, medidas) y el borrado de los
 * metadatos EXIF están en `lib/imagen.ts`, antes de que el archivo salga del
 * navegador.
 */
export function CeldaFoto({ bucket, duenoId, ruta, descripcion, guardar, onCambio, onError }: Props) {
  const [trabajando, setTrabajando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setTrabajando(true);
    const anterior = ruta;

    try {
      const subida = await subirFoto(bucket, duenoId, archivo);
      await guardar(subida.ruta);

      if (anterior) await borrarFoto(bucket, anterior).catch(() => undefined);

      console.info(
        `Foto de ${descripcion}: ${enKb(subida.imagen.bytesOriginal)} -> ${enKb(subida.imagen.bytes)}`,
      );
      onCambio();
    } catch (problema) {
      onError((problema as Error).message);
    } finally {
      setTrabajando(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  const quitar = async () => {
    if (!ruta) return;
    if (!window.confirm(`¿Quitar la foto de ${descripcion}?`)) return;

    setTrabajando(true);
    try {
      await guardar('');
      await borrarFoto(bucket, ruta);
      onCambio();
    } catch (problema) {
      onError((problema as Error).message);
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {ruta ? (
        <img
          src={urlFoto(bucket, ruta)}
          alt={`Foto de ${descripcion}`}
          className="h-12 w-12 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400"
        >
          —
        </div>
      )}

      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled={trabajando}
          onClick={() => entrada.current?.click()}
          className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:border-marca-500 hover:text-marca-700 disabled:opacity-50"
        >
          {trabajando ? 'Subiendo…' : ruta ? 'Cambiar' : 'Subir'}
        </button>
        {ruta && !trabajando && (
          <button
            type="button"
            onClick={() => void quitar()}
            className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-500 hover:border-red-400 hover:text-red-600"
          >
            Quitar
          </button>
        )}
      </div>

      <input
        ref={entrada}
        type="file"
        accept={ACEPTA_INPUT}
        className="hidden"
        onChange={(evento) => void elegir(evento.target.files?.[0])}
      />
    </div>
  );
}
