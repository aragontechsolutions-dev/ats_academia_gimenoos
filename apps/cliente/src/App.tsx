import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProveedorSesion } from './lib/sesion';
import { ProveedorAvisos } from './lib/avisos';
import { Avisos } from './componentes/ui/Avisos';
import { RutaProtegida } from './componentes/RutaProtegida';
import { Disposicion } from './componentes/Disposicion';
import { Ingreso } from './paginas/Ingreso';
import { Entrar } from './paginas/Entrar';
import { MisClases } from './paginas/MisClases';
import { Reservar } from './paginas/Reservar';
import { MiPerfil } from './paginas/MiPerfil';
import { Pagar } from './paginas/Pagar';
import { ManualDeUso } from './paginas/ManualDeUso';
import { Avisos as BajaDeAvisos } from './paginas/Avisos';

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
      {/* Los avisos envuelven todo y se dibujan una sola vez, fuera de las rutas:
          así uno disparado al reservar sobrevive al cambio de pantalla. */}
      <ProveedorAvisos>
        <BrowserRouter>
          <Routes>
            <Route path="/ingresar" element={<Ingreso />} />
            {/* Fuera del guard de sesión: es justamente donde se consigue la sesión. */}
            <Route path="/entrar" element={<Entrar />} />
            {/* Fuera del guard a propósito: se llega desde el pie de un correo,
                y quien lo abre no necesariamente tiene la sesión iniciada. */}
            <Route path="/avisos" element={<BajaDeAvisos />} />
            <Route path="/" element={<Pagina><MisClases /></Pagina>} />
            <Route path="/reservar" element={<Pagina><Reservar /></Pagina>} />
            <Route path="/pagar" element={<Pagina><Pagar /></Pagina>} />
            <Route path="/perfil" element={<Pagina><MiPerfil /></Pagina>} />
            <Route path="/manual" element={<Pagina><ManualDeUso /></Pagina>} />
            <Route path="*" element={<Pagina><MisClases /></Pagina>} />
          </Routes>
        </BrowserRouter>
        <Avisos />
      </ProveedorAvisos>
    </ProveedorSesion>
  );
}
