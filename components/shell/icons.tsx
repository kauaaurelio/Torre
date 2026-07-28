import type { ReactElement, ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: ReactNode }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

// Glifos operacionais, um por unidade. Traço em currentColor: herdam a cor
// do estado do item de menu (ocioso, hover, ativo).
export const Icons: Record<string, (p: IconProps) => ReactElement> = {
  // Conexão — módulos de QR: o único artefato que só existe nesta rota
  qr: (p) => (
    <Base {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3M20.5 14v.01M14 20.5v.01M17.5 17.5v.01M20.5 20.5v.01M20.5 17.5v.01M17.5 20.5v.01" />
    </Base>
  ),
  // Contatos — a base própria
  contatos: (p) => (
    <Base {...p}>
      <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
      <circle cx="9" cy="8" r="3.2" />
      <path d="M22 19v-1a4 4 0 0 0-3-3.87M16 5.13A3.2 3.2 0 0 1 16 11.4" />
    </Base>
  ),
  // Nova campanha — o editor de mensagem
  compose: (p) => (
    <Base {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Base>
  ),
  // Fila — a fita: três módulos em linha
  tape: (p) => (
    <Base {...p}>
      <rect x="3" y="9" width="4" height="6" rx="0.5" />
      <rect x="10" y="9" width="4" height="6" rx="0.5" />
      <rect x="17" y="9" width="4" height="6" rx="0.5" />
    </Base>
  ),
  // Relatório — a taxa de entrega
  report: (p) => (
    <Base {...p}>
      <path d="M4 4v16h16" />
      <rect x="7.5" y="12" width="2.6" height="5" rx="0.5" />
      <rect x="12.5" y="8" width="2.6" height="9" rx="0.5" />
      <rect x="17.5" y="14" width="2.6" height="3" rx="0.5" />
    </Base>
  ),
  // Configurações — os freios: tetos, janela, rampa (sliders, não engrenagem)
  settings: (p) => (
    <Base {...p}>
      <path d="M4 6h9M17 6h3" />
      <circle cx="15" cy="6" r="2" />
      <path d="M4 12h3M11 12h9" />
      <circle cx="9" cy="12" r="2" />
      <path d="M4 18h9M17 18h3" />
      <circle cx="15" cy="18" r="2" />
    </Base>
  ),
  sun: (p) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </Base>
  ),
  moon: (p) => (
    <Base {...p}>
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z" />
    </Base>
  ),
  chevron: (p) => (
    <Base {...p}>
      <path d="M15 6l-6 6 6 6" />
    </Base>
  ),
  alert: (p) => (
    <Base {...p}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Base>
  ),
  info: (p) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Base>
  ),
  power: (p) => (
    <Base {...p}>
      <path d="M12 3v9" />
      <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
    </Base>
  ),
  refresh: (p) => (
    <Base {...p}>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 4v5h-5" />
    </Base>
  ),
  busca: (p) => (
    <Base {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Base>
  ),
  upload: (p) => (
    <Base {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M12 3v13M7 8l5-5 5 5" />
    </Base>
  ),
  mais: (p) => (
    <Base {...p}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  ),
  pausa: (p) => (
    <Base {...p}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </Base>
  ),
  play: (p) => (
    <Base {...p}>
      <path d="M6 4l14 8-14 8Z" />
    </Base>
  ),
  relogio: (p) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Base>
  ),
  enviar: (p) => (
    <Base {...p}>
      <path d="M22 2 11 13" />
      <path d="M22 2l-7 20-4-9-9-4Z" />
    </Base>
  ),
  lixeira: (p) => (
    <Base {...p}>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
    </Base>
  ),
  x: (p) => (
    <Base {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Base>
  ),
  check: (p) => (
    <Base {...p}>
      <path d="M20 6 9 17l-5-5" />
    </Base>
  ),
};
