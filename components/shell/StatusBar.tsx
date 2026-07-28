'use client';

import type { Campanha } from '@/lib/tipos';
import { useSession } from '@/components/session/SessionContext';
import Fita from './Fita';
import SessionLed, { rotuloSessao } from './SessionLed';
import styles from './StatusBar.module.css';

function resumo(c: Campanha) {
  const concluidos = c.modulos.filter(
    (m) => m === 'entregue' || m === 'falhou' || m === 'optout',
  ).length;
  const pct = c.total ? Math.round((concluidos / c.total) * 100) : 0;
  return { concluidos, pct };
}

// A fita fixa no topo: progresso e mapa da campanha ao mesmo tempo. A versão
// grande, com controles, vive na tela Fila (Unidade 6). Aqui é a tira condensada.
// Lê sessão e campanha do contexto — a tela de Conexão escreve no mesmo estado.
export default function StatusBar({ className }: { className?: string }) {
  const { sessao, campanha, conectados, sessoes } = useSession();
  const temCampanha = Boolean(campanha && campanha.total > 0);
  const r = temCampanha ? resumo(campanha) : null;

  // Com vários chips, o número único perde sentido: mostra a contagem.
  const meta =
    conectados > 1
      ? `${conectados} de ${sessoes.length} conectados`
      : sessao.numero ?? (sessoes.length ? `0 de ${sessoes.length} conectados` : '—');

  return (
    <header className={className ? `${styles.bar} ${className}` : styles.bar}>
      <div className={styles.session}>
        <SessionLed estado={sessao.estado} />
        <div className={styles.sessionText}>
          <span className={styles.sessionState}>{rotuloSessao(sessao.estado)}</span>
          <span className={`${styles.sessionMeta} numeric`}>{meta}</span>
        </div>
      </div>

      <span className={styles.divider} aria-hidden="true" />

      {temCampanha && r ? (
        <div className={styles.campaign}>
          <div className={styles.campaignHead}>
            <span className="label">Em campanha</span>
            <span className={styles.campaignName}>{campanha.nome}</span>
          </div>
          <div className={styles.stripWrap}>
            <Fita modulos={campanha.modulos} />
          </div>
          <span className={`${styles.counter} numeric`}>
            {r.concluidos}/{campanha.total} · {r.pct}%
          </span>
        </div>
      ) : (
        <div className={styles.campaignEmpty}>
          <span className="label">Sem campanha ativa</span>
        </div>
      )}
    </header>
  );
}
