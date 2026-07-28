'use client';

import { Icons } from '@/components/shell/icons';
import styles from './ui.module.css';

export default function EstadoErro({
  titulo = 'Não foi possível carregar',
  texto,
  onRetentar,
}: {
  titulo?: string;
  texto: string;
  onRetentar?: () => void;
}) {
  return (
    <div className={styles.erro} role="alert">
      <span className={styles.erroIcone} aria-hidden="true">
        <Icons.alert />
      </span>
      <p className={styles.erroTitulo}>{titulo}</p>
      <p className={styles.erroTexto}>{texto}</p>
      {onRetentar && (
        <button type="button" className={styles.botao} onClick={onRetentar}>
          <Icons.refresh />
          Tentar de novo
        </button>
      )}
    </div>
  );
}
