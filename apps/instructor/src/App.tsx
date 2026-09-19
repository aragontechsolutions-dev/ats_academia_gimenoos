import type { ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { ProveedorSesion } from './lib/sesion';
import { ProveedorAvisos } from './lib/avisos';
import { Avisos } from './componentes/ui/Avisos';
import { RutaProtegida } from './componentes/RutaProtegida';
import { Disposicion } from './componentes/Disposicion';
import { Ingreso } from './paginas/Ingreso';
import { ManualDeUso } from './paginas/ManualDeUso';
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
      {/* Los avisos envuelven todo y se dibujan una sola vez, fuera de las rutas:
          así uno disparado al cerrar una clase sobrevive al redibujado de la
          agenda. */}
      <ProveedorAvisos>
        <BrowserRouter>
          <Routes>
            <Route path="/ingresar" element={<Ingreso />} />
            {/* Fuera del guard de sesión: es justamente donde se consigue la sesión. */}
            <Route path="/entrar" element={<Entrar />} />
            <Route path="/manual" element={<Pagina><ManualDeUso /></Pagina>} />
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
        <Avisos />
      </ProveedorAvisos>
    </ProveedorSesion>
  );
}
