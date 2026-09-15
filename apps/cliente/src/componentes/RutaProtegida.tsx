import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useSesion } from '../lib/sesion';
import { Logotipo } from './Logotipo';

/** A dónde mandar a quien se equivocó de app. Opcionales: sin la variable no se ofrece enlace. */
const APP_INSTRUCTOR = import.meta.env.VITE_APP_INSTRUCTOR_URL;
const APP_PANEL = import.meta.env.VITE_APP_PANEL_URL;

/**
 * Deja pasar solo a un alumno.
 *
 * Hasta acá esta pantalla solo comprobaba que hubiera sesión, y eso resultó no
 * alcanzar: un instructor cuyo enlace de acceso lo trajo a esta dirección
 * —porque Supabase descartó el destino y usó el Site URL del proyecto— entraba
 * sin ningún aviso y veía «Hola, Lautaro · Tus clases de manejo». No es una
 * fuga de datos, porque la API solo le devuelve lo suyo, pero es la app
 * equivocada y nada se lo decía.
 *
 * Las tres aplicaciones usan las mismas cuentas de Supabase, así que tener
 * sesión válida no dice **en cuál** de las tres se está.
 *
 * Es comodidad de interfaz, no control de seguridad: la autorización real la
 * aplica la API, que además le cierra a cada rol lo que no le toca. Acá se
 * decide qué se dibuja, y sobre todo se le dice a la persona dónde tiene que ir.
 *
 * El rol NO se lee del token del navegador: `useSesion` lo pide a la API, que lo
 * lee de la base.
 */
export function RutaProtegida({ children }: { children: ReactNode }) {
  const { sesion, perfil, cargando, errorPerfil } = useSesion();

  if (cargando) return <p className="p-8 text-slate-500">Cargando…</p>;
  if (!sesion) return <Navigate to="/ingresar" replace />;

  // Se pidió el perfil y falló. Antes esto caía en el «Cargando…» de abajo y la
  // app se quedaba ahí para siempre.
  if (errorPerfil) return <NoSePudoAbrir detalle={errorPerfil} />;

  // La sesión ya está, pero todavía no se sabe quién es. Sin esta espera, la
  // pantalla de "esta app es para alumnos" aparecería por un instante en cada
  // carga, incluso para un alumno.
  if (!perfil) return <p className="p-8 text-slate-500">Cargando…</p>;

  if (perfil.rol !== 'CLIENTE') return <NoEsTuApp rol={perfil.rol} />;

  return <>{children}</>;
}

/** Quién sos y a dónde tenés que ir. Sin un callejón sin salida. */
function NoEsTuApp({ rol }: { rol: 'ADMIN' | 'INSTRUCTOR' }) {
  const { cerrarSesion } = useSesion();
  const destino = rol === 'INSTRUCTOR' ? APP_INSTRUCTOR : APP_PANEL;

  return (
    <div className="flex min-h-screen flex-col justify-center bg-carbon-950 px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <Logotipo className="justify-center text-2xl text-white" />

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-xl shadow-black/30">
          <h1 className="text-xl font-bold text-slate-900">Esta app es para alumnos</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {rol === 'INSTRUCTOR'
              ? 'Tu cuenta es de instructor. Tu agenda, el contacto con el alumno y el cierre de cada clase están en la app de instructores.'
              : 'Tu cuenta es de administración. La agenda completa y el resto de la gestión están en el panel.'}
          </p>

          {destino && (
            <a
              href={destino}
              className="mt-5 block rounded-lg bg-marca-600 py-3 text-center font-semibold text-white transition hover:bg-marca-700"
            >
              {rol === 'INSTRUCTOR' ? 'Ir a la app de instructores' : 'Ir al panel'}
            </a>
          )}

          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="mt-3 w-full rounded-lg border border-slate-300 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Cuando la sesión está pero el perfil no se pudo traer.
 *
 * Reemplaza a un «Cargando…» que no terminaba nunca. La app quedaba así ante
 * cualquier fallo al pedir `/usuarios/me`, y eso incluye el caso que lo destapó:
 * una variable de entorno mal cargada hacía que la app le pegara a la API sin su
 * prefijo, la API contestaba 404 y la persona se quedaba mirando la palabra
 * «Cargando…» sin ninguna pista.
 *
 * El mensaje viene de la API y trae el código HTTP, que es lo que separa los dos
 * casos posibles: **403** es una cuenta que la academia todavía no habilitó, y
 * cualquier otro es que esta app no está llegando a la API.
 */
function NoSePudoAbrir({ detalle }: { detalle: string }) {
  const { reintentarPerfil, cerrarSesion } = useSesion();

  return (
    <div className="flex min-h-screen flex-col justify-center bg-carbon-950 px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <Logotipo className="justify-center text-2xl text-white" />

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-xl shadow-black/30">
          <h1 className="text-xl font-bold text-slate-900">No pudimos abrir tu cuenta</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Entraste bien, pero no se pudo cargar tu perfil. Probá de nuevo; si sigue
            pasando, avisale a la academia y pasale este detalle.
          </p>

          {/* El detalle técnico se muestra, no se esconde: es lo único que
              permite resolverlo sin adivinar, y quien lo lee se lo va a pasar a
              alguien que sepa qué hacer con él. */}
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {detalle}
          </p>

          <button
            type="button"
            onClick={reintentarPerfil}
            className="mt-5 w-full rounded-lg bg-marca-600 py-3 font-semibold text-white transition hover:bg-marca-700"
          >
            Probar de nuevo
          </button>
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="mt-3 w-full rounded-lg border border-slate-300 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
