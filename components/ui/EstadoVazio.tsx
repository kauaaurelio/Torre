import type { ReactNode } from 'react';
import { Icons } from '@/components/shell/icons';
import styles from './ui.module.css';

export default function EstadoVazio({
  icone = 'contatos',
  titulo,
  texto,
  acao,
}: {
  icone?: keyof typeof Icons;
  titulo: string;
  texto: string;
  acao?: ReactNode;
}) {
  const Icone = Icons[icone];
  return (
    <div className={styles.vazio}>
      <span className={styles.vazioIcone} aria-hidden="true">
        <Icone />
      </span>
      <p className={styles.vazioTitulo}>{titulo}</p>
      <p className={styles.vazioTexto}>{texto}</p>
      {acao && <div className={styles.vazioAcao}>{acao}</div>}
    </div>
  );
}
