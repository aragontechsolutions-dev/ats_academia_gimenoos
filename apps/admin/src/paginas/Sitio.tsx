import { useCallback, useEffect, useState } from 'react';

import { Boton } from '../componentes/ui/Boton';
import { Aviso } from '../componentes/ui/Aviso';
import { Campo, clasesControl } from '../componentes/ui/Campo';
import { sitio as api } from '../lib/recursos';
import type { ItemSeccion, NegocioLanding, SeccionLanding } from '../lib/tipos';

/** Campos de contacto, con la ayuda que evita los errores más comunes. */
const CAMPOS_NEGOCIO: Array<{
  clave: keyof NegocioLanding;
  etiqueta: string;
  ayuda?: string;
  tipo?: string;
}> = [
  { clave: 'nombre', etiqueta: 'Nombre de la academia' },
  {
    clave: 'whatsapp',
    etiqueta: 'WhatsApp',
    ayuda: 'Solo números, con código de país y sin espacios. Ejemplo: 59899123456',
  },
  { clave: 'telefono', etiqueta: 'Teléfono para mostrar', ayuda: 'Como querés que se vea. Ejemplo: +598 4266 0000' },
  { clave: 'email', etiqueta: 'Correo de contacto', tipo: 'email' },
  { clave: 'direccion', etiqueta: 'Dirección' },
  { clave: 'ciudad', etiqueta: 'Ciudad' },
  { clave: 'departamento', etiqueta: 'Departamento' },
  { clave: 'horarios', etiqueta: 'Horarios de atención', ayuda: 'Ejemplo: Lunes a viernes de 9 a 19' },
  { clave: 'mapaUrl', etiqueta: 'Enlace de Google Maps', ayuda: 'Tiene que empezar con https://' },
  { clave: 'instagram', etiqueta: 'Instagram', ayuda: 'Dirección completa, empezando con https://' },
  { clave: 'facebook', etiqueta: 'Facebook', ayuda: 'Dirección completa, empezando con https://' },
];

export function Sitio() {
  const [negocio, setNegocio] = useState<NegocioLanding | null>(null);
  const [secciones, setSecciones] = useState<SeccionLanding[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    void Promise.all([api.negocio(), api.secciones()])
      .then(([datosNegocio, datosSecciones]) => {
        setNegocio(datosNegocio);
        setSecciones(datosSecciones);
      })
      .catch((problema: Error) => setError(problema.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(cargar, [cargar]);

  /** Muestra el aviso de guardado y lo retira solo. */
  const avisar = (mensaje: string) => {
    setGuardado(mensaje);
    setTimeout(() => setGuardado(null), 4000);
  };

  if (cargando) return <p className="text-slate-500">Cargando…</p>;

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sitio público</h1>
        <p className="mt-1 text-sm text-slate-600">
          Lo que cambies acá se ve en el sitio sin necesidad de publicar nada. Lo que dejes vacío
          vuelve al texto por defecto, y los datos de contacto que falten no se muestran: el sitio
          prefiere omitir un dato antes que inventarlo.
        </p>
      </div>

      {error && (
        <div className="mt-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}
      {guardado && (
        <div className="mt-4">
          <Aviso tipo="exito">{guardado}</Aviso>
        </div>
      )}

      {negocio && (
        <FormularioNegocio
          negocio={negocio}
          onGuardado={(actualizado) => {
            setNegocio(actualizado);
            avisar('Datos de contacto guardados.');
          }}
          onError={setError}
        />
      )}

      <section className="mt-10">
        <h2 className="text-lg font-bold text-slate-900">Secciones</h2>
        <p className="mt-1 text-sm text-slate-600">
          Podés ocultar una sección, cambiar sus textos o reordenarla. Las secciones de fotos
          (vehículos, instructores, testimonios, galería) solo aparecen cuando hay contenido real
          cargado.
        </p>

        <div className="mt-4 space-y-3">
          {secciones.map((seccion) => (
            <TarjetaSeccion
              key={seccion.clave}
              seccion={seccion}
              onGuardado={(actualizada) => {
                setSecciones((previas) =>
                  previas
                    .map((s) => (s.clave === actualizada.clave ? actualizada : s))
                    .sort((a, b) => a.orden - b.orden),
                );
                avisar(`Sección «${actualizada.nombre}» guardada.`);
              }}
              onError={setError}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function FormularioNegocio({
  negocio,
  onGuardado,
  onError,
}: {
  negocio: NegocioLanding;
  onGuardado: (negocio: NegocioLanding) => void;
  onError: (mensaje: string) => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPOS_NEGOCIO.map((c) => [c.clave, negocio[c.clave] ?? ''])),
  );
  const [guardando, setGuardando] = useState(false);

  const guardar = () => {
    setGuardando(true);
    void api
      .guardarNegocio(valores)
      .then((actualizado) => onGuardado(actualizado))
      .catch((problema: Error) => onError(problema.message))
      .finally(() => setGuardando(false));
  };

  const faltaWhatsApp = !valores.whatsapp?.trim();

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-slate-900">Datos de contacto</h2>

      {faltaWhatsApp && (
        <div className="mt-3">
          <Aviso>
            Sin número de WhatsApp el sitio no muestra el botón flotante ni el formulario de
            contacto. Es el dato más importante de la página.
          </Aviso>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {CAMPOS_NEGOCIO.map((campo) => (
          <Campo key={campo.clave} etiqueta={campo.etiqueta} ayuda={campo.ayuda}>
            <input
              type={campo.tipo ?? 'text'}
              value={valores[campo.clave] ?? ''}
              onChange={(evento) =>
                setValores((previos) => ({ ...previos, [campo.clave]: evento.target.value }))
              }
              className={clasesControl}
            />
          </Campo>
        ))}
      </div>

      <div className="mt-5">
        <Boton onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar datos de contacto'}
        </Boton>
      </div>
    </section>
  );
}

function TarjetaSeccion({
  seccion,
  onGuardado,
  onError,
}: {
  seccion: SeccionLanding;
  onGuardado: (seccion: SeccionLanding) => void;
  onError: (mensaje: string) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [borrador, setBorrador] = useState(seccion);
  const [guardando, setGuardando] = useState(false);

  const cambiar = (parcial: Partial<SeccionLanding>) =>
    setBorrador((previo) => ({ ...previo, ...parcial }));

  const cambiarItem = (indice: number, parcial: Partial<ItemSeccion>) =>
    setBorrador((previo) => ({
      ...previo,
      items: previo.items.map((item, i) => (i === indice ? { ...item, ...parcial } : item)),
    }));

  const guardar = () => {
    setGuardando(true);
    void api
      .guardarSeccion(borrador.clave, {
        visible: borrador.visible,
        orden: borrador.orden,
        titulo: borrador.titulo ?? '',
        bajada: borrador.bajada ?? '',
        etiqueta: borrador.etiqueta ?? '',
        accion: borrador.accion ?? '',
        // Se descartan los ítems sin título: una fila vacía en el formulario no
        // es contenido, es una fila que alguien agregó y no llegó a completar.
        items: borrador.items.filter((item) => item.titulo.trim() !== ''),
      })
      .then(() => onGuardado({ ...borrador, personalizada: true }))
      .catch((problema: Error) => onError(problema.message))
      .finally(() => setGuardando(false));
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="w-8 shrink-0 text-sm font-semibold text-slate-400">
            {String(borrador.orden).padStart(2, '0')}
          </span>
          <div>
            <h3 className="font-semibold text-slate-900">{seccion.nombre}</h3>
            <p className="text-xs text-slate-500">
              {borrador.visible ? 'Se muestra en el sitio' : 'Oculta'}
              {seccion.personalizada && ' · con textos propios'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={borrador.visible}
              onChange={(evento) => cambiar({ visible: evento.target.checked })}
              className="h-4 w-4"
            />
            Visible
          </label>
          <button
            type="button"
            onClick={() => setAbierta((previa) => !previa)}
            aria-expanded={abierta}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-slate-400"
          >
            {abierta ? 'Cerrar' : 'Editar textos'}
          </button>
        </div>
      </div>

      {abierta && (
        <div className="border-t border-slate-100 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Sobretítulo" ayuda="El texto chico arriba del título.">
              <input
                value={borrador.etiqueta ?? ''}
                onChange={(evento) => cambiar({ etiqueta: evento.target.value })}
                className={clasesControl}
              />
            </Campo>
            <Campo etiqueta="Orden" ayuda="Menor número, más arriba en la página.">
              <input
                type="number"
                min={0}
                max={99}
                value={borrador.orden}
                onChange={(evento) => cambiar({ orden: Number(evento.target.value) })}
                className={clasesControl}
              />
            </Campo>
          </div>

          <div className="mt-4">
            <Campo etiqueta="Título" ayuda="Vacío = se usa el texto por defecto del sitio.">
              <input
                value={borrador.titulo ?? ''}
                onChange={(evento) => cambiar({ titulo: evento.target.value })}
                className={clasesControl}
              />
            </Campo>
          </div>

          <div className="mt-4">
            <Campo etiqueta="Bajada">
              <textarea
                rows={3}
                value={borrador.bajada ?? ''}
                onChange={(evento) => cambiar({ bajada: evento.target.value })}
                className={clasesControl}
              />
            </Campo>
          </div>

          <div className="mt-4">
            <Campo etiqueta="Texto del botón" ayuda="Solo en las secciones que tienen botón.">
              <input
                value={borrador.accion ?? ''}
                onChange={(evento) => cambiar({ accion: evento.target.value })}
                className={clasesControl}
              />
            </Campo>
          </div>

          {seccion.admiteItems && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-slate-900">
                {seccion.clave === 'preguntas' ? 'Preguntas y respuestas' : 'Ítems'}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Si no cargás ninguno, el sitio usa los que ya vienen escritos. Máximo 20.
              </p>

              <div className="mt-3 space-y-3">
                {borrador.items.map((item, indice) => (
                  <div key={indice} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-2">
                        <input
                          value={item.titulo}
                          placeholder={seccion.clave === 'preguntas' ? 'Pregunta' : 'Título'}
                          onChange={(evento) => cambiarItem(indice, { titulo: evento.target.value })}
                          className={clasesControl}
                        />
                        <textarea
                          rows={2}
                          value={item.detalle ?? ''}
                          placeholder={seccion.clave === 'preguntas' ? 'Respuesta' : 'Detalle'}
                          onChange={(evento) =>
                            cambiarItem(indice, { detalle: evento.target.value })
                          }
                          className={clasesControl}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          cambiar({ items: borrador.items.filter((_, i) => i !== indice) })
                        }
                        className="mt-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-red-400 hover:text-red-600"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {borrador.items.length < 20 && (
                <button
                  type="button"
                  onClick={() => cambiar({ items: [...borrador.items, { titulo: '', detalle: '' }] })}
                  className="mt-3 rounded border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-marca-600 hover:text-marca-700"
                >
                  Agregar
                </button>
              )}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Boton onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar sección'}
            </Boton>
            <button
              type="button"
              onClick={() => setBorrador(seccion)}
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-400"
            >
              Descartar cambios
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
