import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, CircleAlert } from 'lucide-react';

import { verificarDiploma, type VerificacionDiploma } from '../lib/api';
import { Seccion, TituloSeccion } from '../componentes/ui/Seccion';
import { clasesBoton } from '../componentes/ui/Boton';
import { useNegocio } from '../contexto/ContenidoContexto';

const CATEGORIA: Record<string, string> = {
  A: 'Automóvil',
  G1: 'Ciclomotor',
  G2: 'Motocicleta',
  G3: 'Motocicleta',
};

/**
 * Verificación de un diploma por su código.
 *
 * Existe para que el diploma pueda ser comprobable sin llevar impreso ningún
 * dato sensible. Quien tiene el papel en la mano tipea el código y confirma que
 * la academia efectivamente lo emitió.
 */
export function PaginaDiploma() {
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState<VerificacionDiploma | 'no-encontrado' | null>(null);
  const [consultando, setConsultando] = useState(false);
  const negocio = useNegocio();

  useEffect(() => {
    document.title = `Verificar un diploma | ${negocio.nombre}`;
  }, [negocio.nombre]);

  const verificar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!codigo.trim()) return;

    setConsultando(true);
    setResultado(null);
    void verificarDiploma(codigo)
      .then((respuesta) => setResultado(respuesta ?? 'no-encontrado'))
      .finally(() => setConsultando(false));
  };

  return (
    <main className="min-h-screen bg-white">
      <header className="bg-carbon-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-acento-400"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Volver al inicio
          </Link>
        </div>
      </header>

      <Seccion>
        <div className="mx-auto max-w-xl">
          <TituloSeccion
            sobretitulo="Verificación"
            titulo="¿Este diploma es auténtico?"
            bajada="Ingresá el código que figura en el diploma y te confirmamos si lo emitimos nosotros."
          />

          <form onSubmit={verificar} className="aparece mt-8">
            <label htmlFor="codigo" className="block text-sm font-bold text-carbon-950">
              Código del diploma
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                id="codigo"
                value={codigo}
                onChange={(evento) => setCodigo(evento.target.value)}
                placeholder="Por ejemplo: A2B4C6D8"
                maxLength={20}
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 font-mono uppercase tracking-widest text-carbon-950 outline-none transition focus:border-marca-500 focus:ring-2 focus:ring-marca-200"
              />
              <button
                type="submit"
                disabled={consultando}
                className={`${clasesBoton('primario')} shrink-0 disabled:opacity-60`}
              >
                {consultando ? 'Buscando…' : 'Verificar'}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              No distingue mayúsculas de minúsculas y podés omitir los guiones.
            </p>
          </form>

          {resultado === 'no-encontrado' && (
            <div
              role="status"
              className="mt-8 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-5"
            >
              <CircleAlert size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="font-bold text-amber-900">No encontramos ese código</p>
                <p className="mt-1 text-sm text-amber-800">
                  Revisá que esté bien tipeado. Si el código es correcto y sigue sin aparecer,
                  escribinos y lo verificamos con vos.
                </p>
              </div>
            </div>
          )}

          {resultado && resultado !== 'no-encontrado' && (
            <div
              role="status"
              className="mt-8 rounded-2xl border-2 border-green-500 bg-green-50 p-6"
            >
              <p className="flex items-center gap-2 font-bold text-green-900">
                <BadgeCheck size={22} aria-hidden="true" />
                Diploma auténtico
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-green-800">Egresado:</dt>
                  <dd className="font-bold text-green-900">
                    {resultado.nombre} {resultado.apellido}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-green-800">Categoría:</dt>
                  <dd className="font-bold text-green-900">
                    {resultado.categoria} — {CATEGORIA[resultado.categoria] ?? resultado.categoria}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-green-800">Año:</dt>
                  <dd className="font-bold text-green-900">{resultado.anio}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </Seccion>
    </main>
  );
}
