const ESTILOS = {
  error: 'bg-red-50 text-red-800 border-red-200',
  exito: 'bg-green-50 text-green-800 border-green-200',
  info: 'bg-marca-50 text-marca-900 border-marca-100',
} as const;

export function Aviso({
  tipo = 'info',
  children,
}: {
  tipo?: keyof typeof ESTILOS;
  children: React.ReactNode;
}) {
  return (
    <p role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${ESTILOS[tipo]}`}>
      {children}
    </p>
  );
}
