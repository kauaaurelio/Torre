'use client';

import { useCallback, useState } from 'react';
import { useSession } from '@/components/session/SessionContext';
import SessionLed from '@/components/shell/SessionLed';
import { Icons } from '@/components/shell/icons';
import type { SessaoResumo, EstadoConexaoRaw, EstadoSessao } from '@/lib/tipos';
import styles from './ConexaoScreen.module.css';

const LED: Record<EstadoConexaoRaw, EstadoSessao> = {
  sem_sessao: 'desconhecido',
  gerando_qr: 'conectando',
  aguardando_leitura: 'conectando',
  conectando: 'conectando',
  conectado: 'conectado',
  caiu: 'caiu',
  breaker: 'caiu',
};

const ROTULO_ESTADO: Record<EstadoConexaoRaw, string> = {
  sem_sessao: 'Sem sessão',
  gerando_qr: 'Gerando QR…',
  aguardando_leitura: 'Aguardando leitura',
  conectando: 'Conectando…',
  conectado: 'Conectado',
  caiu: 'Sessão caiu',
  breaker: 'Pausado · circuit breaker',
};

export default function ConexaoScreen() {
  const { sessoes, workerOnline, recarregar } = useSession();
  const [ocupado, setOcupado] = useState(false);

  const comando = useCallback(
    async (sessaoId: string, acao: 'conectar' | 'desconectar') => {
      setOcupado(true);
      try {
        await fetch('/api/sessao/comando', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessaoId, acao }),
        });
        await recarregar();
      } finally {
        setOcupado(false);
      }
    },
    [recarregar],
  );

  const adicionar = useCallback(async () => {
    setOcupado(true);
    try {
      const r = await fetch('/api/sessao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await r.json();
      if (r.ok && data.id) {
        // Já pede o pareamento do chip recém-criado.
        await fetch('/api/sessao/comando', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessaoId: data.id, acao: 'conectar' }),
        });
      }
      await recarregar();
    } finally {
      setOcupado(false);
    }
  }, [recarregar]);

  const remover = useCallback(
    async (s: SessaoResumo) => {
      if (
        !window.confirm(
          `Remover ${s.rotulo}? A sessão é encerrada e as credenciais apagadas — re-adicionar pede QR novo.`,
        )
      )
        return;
      setOcupado(true);
      try {
        await fetch(`/api/sessao?id=${encodeURIComponent(s.id)}`, { method: 'DELETE' });
        await recarregar();
      } finally {
        setOcupado(false);
      }
    },
    [recarregar],
  );

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <p className="label">Sessão</p>
        <h1 className={styles.title}>Conexão</h1>
        <p className={styles.desc}>
          Um chip dedicado por número, pareado via QR. Vários números diluem o
          volume por chip — cada um tem sua própria rampa e seu próprio teto.
        </p>
      </header>

      {!workerOnline ? (
        <div className={styles.corpo}>
          <section className={styles.painel}>
            <span className={styles.painelIcone} aria-hidden="true">
              <Icons.power />
            </span>
            <h2 className={styles.painelTitulo}>Worker offline</h2>
            <p className={styles.painelTexto}>
              O processo que segura as sessões do WhatsApp não está rodando. Sem ele
              não há pareamento nem disparo. Abra um terminal na pasta do projeto e
              rode:
            </p>
            <code className={styles.workerOff}>npm run worker</code>
            <p className={styles.painelTexto}>
              Deixe esse terminal aberto durante a campanha — se ele cair, as
              sessões caem junto.
            </p>
          </section>
          {avisoChip()}
        </div>
      ) : (
        <div className={styles.corpo}>
          <div className={styles.topo}>
            <span className={`${styles.topoContagem} numeric`}>
              {sessoes.length} número{sessoes.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={ocupado}
              onClick={adicionar}
            >
              <Icons.qr />
              Adicionar número
            </button>
          </div>

          {sessoes.length === 0 ? (
            <section className={styles.painel}>
              <span className={styles.painelIcone} aria-hidden="true">
                <Icons.qr />
              </span>
              <h2 className={styles.painelTitulo}>Nenhum número ainda</h2>
              <p className={styles.painelTexto}>
                Adicione um número pra parear o primeiro chip. Use sempre um chip
                dedicado — nunca o número principal da agência.
              </p>
            </section>
          ) : (
            <div className={styles.lista}>
              {sessoes.map((s) => (
                <CardChip
                  key={s.id}
                  sessao={s}
                  ocupado={ocupado}
                  onConectar={() => comando(s.id, 'conectar')}
                  onDesconectar={() => comando(s.id, 'desconectar')}
                  onRemover={() => remover(s)}
                />
              ))}
            </div>
          )}

          {avisoChip()}
        </div>
      )}
    </div>
  );

  function avisoChip() {
    return (
      <aside className={styles.aviso} data-tone="warning">
        <span className={styles.avisoIcone} aria-hidden="true">
          <Icons.alert />
        </span>
        <p className={styles.avisoTexto}>
          <strong>Use chips dedicados.</strong> Nunca o número principal da agência.
          A rota QR viola os termos do WhatsApp — o risco de banimento é real e
          recai sobre cada número pareado.
        </p>
      </aside>
    );
  }
}

function CardChip({
  sessao: s,
  ocupado,
  onConectar,
  onDesconectar,
  onRemover,
}: {
  sessao: SessaoResumo;
  ocupado: boolean;
  onConectar: () => void;
  onDesconectar: () => void;
  onRemover: () => void;
}) {
  const emVoo =
    s.estadoRaw === 'gerando_qr' ||
    s.estadoRaw === 'aguardando_leitura' ||
    s.estadoRaw === 'conectando';

  return (
    <section className={styles.card} data-estado={s.estadoRaw}>
      <div className={styles.cardHead}>
        <SessionLed estado={LED[s.estadoRaw]} />
        <div className={styles.cardInfo}>
          <span className={styles.cardRotulo}>{s.rotulo}</span>
          <span className={styles.cardEstado}>{ROTULO_ESTADO[s.estadoRaw]}</span>
        </div>
        {s.estadoRaw === 'conectado' && s.numero && (
          <span className={`${styles.phone} numeric`}>{s.numero}</span>
        )}
        <div className={styles.cardAcoes}>
          {s.estadoRaw === 'conectado' ? (
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={ocupado}
              onClick={onDesconectar}
            >
              <Icons.power />
              Desconectar
            </button>
          ) : (
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={ocupado}
              onClick={onConectar}
            >
              <Icons.refresh />
              {s.estadoRaw === 'caiu' || s.estadoRaw === 'breaker' ? 'Reconectar' : 'Parear'}
            </button>
          )}
          <button
            type="button"
            className={styles.btnGhost}
            disabled={ocupado}
            onClick={onRemover}
            title="Remover número"
            aria-label={`Remover ${s.rotulo}`}
          >
            <Icons.x />
          </button>
        </div>
      </div>

      {s.estadoRaw === 'aguardando_leitura' && (
        <div className={styles.cardQr}>
          {s.qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.qrImagem} src={s.qr} alt={`QR de ${s.rotulo}`} />
          ) : (
            <div className={styles.qrImagem} aria-hidden="true" />
          )}
          <ol className={styles.passos}>
            <li>Abra o WhatsApp no celular do chip dedicado</li>
            <li>
              Toque em <strong>Aparelhos conectados</strong>
            </li>
            <li>
              <strong>Conectar um aparelho</strong>
            </li>
            <li>Aponte a câmera para o código</li>
          </ol>
        </div>
      )}

      {emVoo && s.estadoRaw !== 'aguardando_leitura' && (
        <p className={styles.cardNota}>
          O worker está subindo a sessão e pedindo o código de pareamento.
        </p>
      )}

      {(s.estadoRaw === 'caiu' || s.estadoRaw === 'breaker') && s.motivo && (
        <p className={styles.cardNota} data-tone="error">
          {s.motivo} A fila fixa neste número foi pausada.
        </p>
      )}
    </section>
  );
}
