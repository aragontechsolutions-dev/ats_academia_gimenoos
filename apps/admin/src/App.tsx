import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProveedorSesion } from './lib/sesion';
import { RutaProtegida } from './componentes/RutaProtegida';
import { Disposicion } from './componentes/Disposicion';
import { Ingreso } from './paginas/Ingreso';
import { Inicio } from './paginas/Inicio';
import { Servicios } from './paginas/Servicios';

export function App() {
  return (
    <ProveedorSesion>
      <BrowserRouter>
        <Routes>
          <Route path="/ingresar" element={<Ingreso />} />
          <Route
            path="/"
            element={
              <RutaProtegida>
                <Disposicion>
                  <Inicio />
                </Disposicion>
              </RutaProtegida>
            }
          />
          <Route
            path="/servicios"
            element={
              <RutaProtegida rolesPermitidos={['ADMIN']}>
                <Disposicion>
                  <Servicios />
                </Disposicion>
              </RutaProtegida>
            }
          />
        </Routes>
      </BrowserRouter>
    </ProveedorSesion>
  );
}
