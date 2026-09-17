import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProveedorSesion } from './lib/sesion';
import { ProveedorAvisos } from './lib/avisos';
import { Avisos } from './componentes/ui/Avisos';
import { RutaProtegida } from './componentes/RutaProtegida';
import { Disposicion } from './componentes/Disposicion';
import { Ingreso } from './paginas/Ingreso';
import { Entrar } from './paginas/Entrar';
import { Agenda } from './paginas/Agenda';
import { Alumnos } from './paginas/Alumnos';
import { AlumnoFicha } from './paginas/AlumnoFicha';
import { Instructores } from './paginas/Instructores';
import { Vehiculos } from './paginas/Vehiculos';
import { Servicios } from './paginas/Servicios';
import { Sitio } from './paginas/Sitio';
import { Graduados } from './paginas/Graduados';
import { Cuentas } from './paginas/Cuentas';

/**
 * Envuelve una página con el guard y la disposición del panel.
 *
 * Ya no recibe qué roles se permiten: el panel entero es de administración. El
 * instructor tiene su propia app desde la Etapa 2.D, así que la única pregunta
 * que queda es «¿sos ADMIN?», y esa la contesta `RutaProtegida` por su cuenta.
 */
function Pagina({ children }: { children: React.ReactNode }) {
  return (
    <RutaProtegida>
      <Disposicion>{children}</Disposicion>
    </RutaProtegida>
  );
}

export function App() {
  return (
    <ProveedorSesion>
      {/* Los avisos envuelven todo y se dibujan una sola vez, fuera de las
          rutas: así uno disparado al guardar sobrevive al cambio de pantalla. */}
      <ProveedorAvisos>
        <BrowserRouter>
          <Routes>
            <Route path="/ingresar" element={<Ingreso />} />
            {/* Fuera del guard de rol: es donde se consigue la sesión. */}
            <Route path="/entrar" element={<Entrar />} />

            <Route path="/" element={<Pagina><Agenda /></Pagina>} />
            <Route path="/alumnos" element={<Pagina><Alumnos /></Pagina>} />
            <Route path="/alumnos/:id" element={<Pagina><AlumnoFicha /></Pagina>} />

            {/* La configuración de la academia es solo del administrador. */}
            <Route
              path="/instructores"
              element={<Pagina><Instructores /></Pagina>}
            />
            <Route
              path="/vehiculos"
              element={<Pagina><Vehiculos /></Pagina>}
            />
            <Route
              path="/servicios"
              element={<Pagina><Servicios /></Pagina>}
            />
            <Route
              path="/graduados"
              element={<Pagina><Graduados /></Pagina>}
            />
            <Route
              path="/sitio"
              element={<Pagina><Sitio /></Pagina>}
            />
            <Route
              path="/cuentas"
              element={<Pagina><Cuentas /></Pagina>}
            />

            <Route path="*" element={<Pagina><Agenda /></Pagina>} />
          </Routes>
        </BrowserRouter>
        <Avisos />
      </ProveedorAvisos>
    </ProveedorSesion>
  );
}
