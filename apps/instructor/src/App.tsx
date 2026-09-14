import type { ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { ProveedorSesion } from './lib/sesion';
import { RutaProtegida } from './componentes/RutaProtegida';
import { Disposicion } from './componentes/Disposicion';
import { Ingreso } from './paginas/Ingreso';
import { Entrar } from './paginas/Entrar';
import { MiAgenda } from './paginas/MiAgenda';

function Pagina({ children }: { children: ReactNode }) {
  return (
    <RutaProtegida>
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
          {/* Fuera del guard de sesión: es justamente donde se consigue la sesión. */}
          <Route path="/entrar" element={<Entrar />} />
          <Route
            path="*"
            element={
              <Pagina>
                <MiAgenda />
              </Pagina>
            }
          />
        </Routes>
      </BrowserRouter>
    </ProveedorSesion>
  );
}
