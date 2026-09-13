import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProveedorSesion } from './lib/sesion';
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

/** Envuelve una página con el guard de rol y la disposición del panel. */
function Pagina({
  children,
  rolesPermitidos,
}: {
  children: React.ReactNode;
  rolesPermitidos?: Array<'ADMIN' | 'INSTRUCTOR' | 'CLIENTE'>;
}) {
  return (
    <RutaProtegida rolesPermitidos={rolesPermitidos}>
      <Disposicion>{children}</Disposicion>
    </RutaProtegida>
  );
}

export function App() {
  return (
    <ProveedorSesion>
      <BrowserRouter>
        <Routes>
          <Route path="/ingresar" element={<Ingreso />} />
          {/* Fuera del guard de rol: es donde se consigue la sesión. */}
          <Route path="/entrar" element={<Entrar />} />

          {/* La agenda y los alumnos también los usa el instructor. */}
          <Route path="/" element={<Pagina><Agenda /></Pagina>} />
          <Route path="/alumnos" element={<Pagina><Alumnos /></Pagina>} />
          <Route path="/alumnos/:id" element={<Pagina><AlumnoFicha /></Pagina>} />

          {/* La configuración de la academia es solo del administrador. */}
          <Route
            path="/instructores"
            element={<Pagina rolesPermitidos={['ADMIN']}><Instructores /></Pagina>}
          />
          <Route
            path="/vehiculos"
            element={<Pagina rolesPermitidos={['ADMIN']}><Vehiculos /></Pagina>}
          />
          <Route
            path="/servicios"
            element={<Pagina rolesPermitidos={['ADMIN']}><Servicios /></Pagina>}
          />
          <Route
            path="/graduados"
            element={<Pagina rolesPermitidos={['ADMIN']}><Graduados /></Pagina>}
          />
          <Route
            path="/sitio"
            element={<Pagina rolesPermitidos={['ADMIN']}><Sitio /></Pagina>}
          />
          <Route
            path="/cuentas"
            element={<Pagina rolesPermitidos={['ADMIN']}><Cuentas /></Pagina>}
          />

          <Route path="*" element={<Pagina><Agenda /></Pagina>} />
        </Routes>
      </BrowserRouter>
    </ProveedorSesion>
  );
}
