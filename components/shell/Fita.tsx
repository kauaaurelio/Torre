import type { EstadoModulo } from '@/lib/tipos';

// A assinatura. As classes .fita / .fita__modulo e todos os estados vivem em
// globals.css — aqui só materializamos um <span> por contato. 'fila' é o
// estado padrão (grafite), então não carrega data-estado.
export default function Fita({
  modulos,
  className,
}: {
  modulos: EstadoModulo[];
  className?: string;
}) {
  return (
    <div
      className={className ? `fita ${className}` : 'fita'}
      role="img"
      aria-label={`Fita da campanha — ${modulos.length} contatos`}
    >
      {modulos.map((estado, i) => (
        <span
          key={i}
          className="fita__modulo"
          {...(estado !== 'fila' ? { 'data-estado': estado } : {})}
        />
      ))}
    </div>
  );
}
