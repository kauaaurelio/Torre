'use client';

import { useState } from 'react';
import { SessionProvider } from '@/components/session/SessionContext';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
import styles from './AppShell.module.css';

// A moldura: sidebar (coluna), barra de status com a fita (topo do conteúdo) e
// a área de tela. Grid de duas colunas x duas linhas; a sidebar ocupa a coluna
// inteira para levar a marca no topo-esquerda. Envolve tudo no SessionProvider,
// que faz polling de /api/estado — a barra e as telas leem o mesmo estado real.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SessionProvider>
      <div className={styles.shell} data-collapsed={collapsed}>
        <Sidebar
          className={styles.sidebar}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
        <StatusBar className={styles.statusbar} />
        <main className={styles.main}>{children}</main>
      </div>
    </SessionProvider>
  );
}
