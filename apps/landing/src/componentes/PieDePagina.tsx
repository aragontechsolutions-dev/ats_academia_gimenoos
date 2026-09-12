import { academia, legal } from '../contenido';

export function PieDePagina() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {academia.nombre} · {academia.ciudad},{' '}
          {academia.departamento}, {academia.pais}
        </p>
        <nav className="flex gap-4" aria-label="Enlaces legales">
          <a href={legal.politicaPrivacidad} className="hover:text-marca-600">
            Política de privacidad
          </a>
          <a href={legal.terminos} className="hover:text-marca-600">
            Términos y condiciones
          </a>
        </nav>
      </div>
    </footer>
  );
}
