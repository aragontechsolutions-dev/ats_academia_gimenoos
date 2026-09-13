import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProveedorSesion } from './lib/sesion';
import { RutaProtegida } from './componentes/RutaProtegida';
import { Disposicion } from './componentes/Disposicion';
import { Ingreso } from './paginas/Ingreso';
import { MisClases } from './paginas/MisClases';
import { Reservar } from './paginas/Reservar';
import { MiPerfil } from './paginas/MiPerfil';

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
      <BrowserRouter>
        <Routes>
          <Route path="/ingresar" element={<Ingreso />} />
          <Route path="/" element={<Pagina><MisClases /></Pagina>} />
          <Route path="/reservar" element={<Pagina><Reservar /></Pagina>} />
          <Route path="/perfil" element={<Pagina><MiPerfil /></Pagina>} />
          <Route path="*" element={<Pagina><MisClases /></Pagina>} />
        </Routes>
      </BrowserRouter>
    </ProveedorSesion>
  );
}
