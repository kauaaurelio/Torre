import type { ReactNode } from 'react';
import styles from './ui.module.css';

export type BadgeTone = 'success' | 'error' | 'warning' | 'info' | 'neutral';

// Sempre ícone + rótulo. Nunca comunica estado só por cor.
export default function Badge({
  tone = 'neutral',
  icone,
  children,
}: {
  tone?: BadgeTone;
  icone?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {icone && <span className={styles.badgeIcone} aria-hidden="true">{icone}</span>}
      {children}
    </span>
  );
}
