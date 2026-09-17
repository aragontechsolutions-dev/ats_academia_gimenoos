import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { ErrorApi } from './api';

export type TipoDeAviso = 'exito' | 'error';

export interface Aviso {
  id: number;
  tipo: TipoDeAviso;
  texto: string;
  /** Una línea por campo, cuando el problema fue de validación. */
  detalles: string[];
}

interface ContextoAvisos {
  avisos: Aviso[];
  /** «Alumno creado», «Clase cancelada». Lo que pasó, dicho en concreto. */
  exito: (texto: string) => void;
  /** El motivo real del fallo, tal como lo explica la API. */
  error: (problema: unknown) => void;
  cerrar: (id: number) => void;
}

const Contexto = createContext<ContextoAvisos | null>(null);

/** Cuánto queda en pantalla cada tipo de aviso. */
const DURACION_MS: Record<TipoDeAviso, number> = {
  // Un «listo» no hay que leerlo entero: se ve de reojo y se sigue trabajando.
  exito: 4000,
  // Un error sí hay que leerlo, y a veces copiarlo. Que se vaya solo antes de
  // eso es la misma falla que un mensaje genérico: la información existió y no
  // llegó. Se queda hasta que se lo cierra.
  error: 0,
};

/**
 * De dónde sale el texto de un error.
 *
 * El orden importa. Lo primero que se intenta es lo que dijo la API, porque
 * está escrito para que lo lea una persona: «Ese instructor ya tiene una clase
 * en el horario seleccionado» resuelve el problema; «Error al guardar» obliga a
 * adivinar. Recién si no hay nada de eso se cae a un texto propio.
 */
function textoDelProblema(problema: unknown): { texto: string; detalles: string[] } {
  if (problema instanceof ErrorApi) {
    return { texto: problema.message, detalles: problema.detalles };
  }
  if (problema instanceof Error && problema.message) {
    return { texto: problema.message, detalles: [] };
  }
  return { texto: 'No se pudo completar la operación.', detalles: [] };
}

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  // Un contador y no Date.now(): dos avisos disparados en el mismo milisegundo
  // compartirían clave y React reusaría el nodo del anterior.
  const siguienteId = useRef(1);

  const cerrar = useCallback((id: number) => {
    setAvisos((actuales) => actuales.filter((a) => a.id !== id));
  }, []);

  const agregar = useCallback(
    (tipo: TipoDeAviso, texto: string, detalles: string[]) => {
      const id = siguienteId.current++;
      setAvisos((actuales) => [...actuales, { id, tipo, texto, detalles }]);

      const duracion = DURACION_MS[tipo];
      if (duracion > 0) setTimeout(() => cerrar(id), duracion);
    },
    [cerrar],
  );

  const valor = useMemo<ContextoAvisos>(
    () => ({
      avisos,
      cerrar,
      exito: (texto: string) => agregar('exito', texto, []),
      error: (problema: unknown) => {
        const { texto, detalles } = textoDelProblema(problema);
        agregar('error', texto, detalles);
      },
    }),
    [avisos, agregar, cerrar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAvisos(): ContextoAvisos {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useAvisos debe usarse dentro de <ProveedorAvisos>');
  return contexto;
}
