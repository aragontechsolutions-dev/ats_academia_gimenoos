import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProveedorSesion } from './lib/sesion';
import { RutaProtegida } from './componentes/RutaProtegida';
import { Ingreso } from './paginas/Ingreso';
import { Inicio } from './paginas/Inicio';

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
                <Inicio />
              </RutaProtegida>
            }
          />
        </Routes>
      </BrowserRouter>
    </ProveedorSesion>
  );
}
