import styles from './ui.module.css';

// Blocos estáticos de carregamento. Não pulsam de propósito: no Torre, só a fita
// e o LED se movem.
export default function Skeleton({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className={styles.skel} aria-hidden="true">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className={styles.skelBarra} />
      ))}
    </div>
  );
}
