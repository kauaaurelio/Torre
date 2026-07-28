import type { Metadata } from 'next';
import '../globals.css';
import AppShell from '@/components/shell/AppShell';
import UpdateModal from '@/components/update/UpdateModal';

export const metadata: Metadata = {
  title: { default: 'Torre', template: '%s · Torre' },
  description:
    'Painel de disparo de campanhas no WhatsApp — rota QR, base própria com opt-in.',
};

// Aplica o tema salvo antes do primeiro paint, para não piscar do escuro
// (padrão) para o claro. Escuro vive em :root; claro em [data-theme="light"].
const THEME_INIT = `(function(){try{if(localStorage.getItem('torre-tema')==='claro'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <UpdateModal />
      </body>
    </html>
  );
}
