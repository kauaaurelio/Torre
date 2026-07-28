import type { EstadoSessao } from '@/lib/tipos';

const rotulo: Record<EstadoSessao, string> = {
  conectado: 'Conectado',
  conectando: 'Conectando…',
  caiu: 'Sessão caiu',
  desconhecido: 'Sem sessão',
};

export function rotuloSessao(e: EstadoSessao): string {
  return rotulo[e];
}

// Regra do projeto: estado nunca só por cor. O LED sempre anda ao lado de um
// rótulo (ver StatusBar). Só o LED de conexão e o módulo em voo pulsam na
// interface inteira — o pulso está em globals.css, no data-estado.
const dataEstado: Record<EstadoSessao, string | undefined> = {
  conectado: 'conectado',
  conectando: 'conectando',
  caiu: 'caiu',
  desconhecido: undefined,
};

export default function SessionLed({ estado }: { estado: EstadoSessao }) {
  const de = dataEstado[estado];
  return (
    <span
      className="led"
      {...(de ? { 'data-estado': de } : {})}
      aria-hidden="true"
    />
  );
}
