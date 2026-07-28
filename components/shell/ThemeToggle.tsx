'use client';

import { useEffect, useState } from 'react';
import { Icons } from './icons';
import styles from './Sidebar.module.css';

// Escuro é o padrão (:root). Claro é o desvio, marcado em [data-theme="light"].
export default function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const [claro, setClaro] = useState(false);

  useEffect(() => {
    setClaro(document.documentElement.getAttribute('data-theme') === 'light');
  }, []);

  function alterna() {
    const novo = !claro;
    setClaro(novo);
    const raiz = document.documentElement;
    if (novo) {
      raiz.setAttribute('data-theme', 'light');
      try {
        localStorage.setItem('torre-tema', 'claro');
      } catch {}
    } else {
      raiz.removeAttribute('data-theme');
      try {
        localStorage.setItem('torre-tema', 'escuro');
      } catch {}
    }
  }

  const Icon = claro ? Icons.moon : Icons.sun;
  const alvo = claro ? 'Mudar para tema escuro' : 'Mudar para tema claro';

  return (
    <button
      type="button"
      className={styles.footerBtn}
      onClick={alterna}
      title={alvo}
      aria-label={alvo}
    >
      <span className={styles.footerIcon}>
        <Icon />
      </span>
      {!collapsed && (
        <span className={styles.footerLabel}>{claro ? 'Tema claro' : 'Tema escuro'}</span>
      )}
    </button>
  );
}
