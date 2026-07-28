'use client';

// Modal de atualização (auto-update). Fala com o main via window.torreUpdate,
// exposto pelo preload do Electron. Fora do Electron (ex.: dev no navegador),
// window.torreUpdate é undefined e o componente não renderiza nada.
//
// Fluxo: available -> (Atualizar agora) -> downloading (%, velocidade) ->
// downloaded (mensagem + reinício automático via quitAndInstall). Erro mostra
// mensagem amigável. "Já é a última versão" não abre janela nenhuma.

import { useEffect, useRef, useState } from 'react';
import { Icons } from '@/components/shell/icons';
import styles from './UpdateModal.module.css';

type Fase = 'oculto' | 'disponivel' | 'baixando' | 'concluido' | 'erro';

interface Progresso {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

interface TorreUpdate {
  on(cb: (canal: string, dados: unknown) => void): () => void;
  startDownload(): Promise<void>;
  install(): Promise<void>;
}

declare global {
  interface Window {
    torreUpdate?: TorreUpdate;
  }
}

function formataVelocidade(bps: number): string {
  if (!bps || bps < 0) return '—';
  const mb = bps / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB/s`;
  const kb = bps / 1024;
  return `${kb.toFixed(0)} KB/s`;
}

function formataMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UpdateModal() {
  const [fase, setFase] = useState<Fase>('oculto');
  const [versao, setVersao] = useState<string>('');
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [erro, setErro] = useState<string>('');
  const reiniciando = useRef(false);

  useEffect(() => {
    const api = window.torreUpdate;
    if (!api) return; // não é o app Electron — nada a fazer

    const desinscrever = api.on((canal, dados) => {
      switch (canal) {
        case 'update:available':
          setVersao((dados as { version?: string })?.version ?? '');
          setProgresso(null);
          setErro('');
          setFase('disponivel');
          break;
        case 'update:progress':
          setProgresso(dados as Progresso);
          setFase('baixando');
          break;
        case 'update:downloaded':
          setFase('concluido');
          // Reinicia sozinho depois de deixar a mensagem visível um instante.
          if (!reiniciando.current) {
            reiniciando.current = true;
            setTimeout(() => window.torreUpdate?.install(), 2600);
          }
          break;
        case 'update:error':
          setErro((dados as { message?: string })?.message ?? 'Falha na atualização.');
          setFase('erro');
          break;
        // 'update:checking' e 'update:none' não abrem janela.
        default:
          break;
      }
    });

    return desinscrever;
  }, []);

  if (fase === 'oculto') return null;

  const pct = progresso ? Math.max(0, Math.min(100, Math.round(progresso.percent))) : 0;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Atualização">
      <div className={styles.modal}>
        {fase === 'disponivel' && (
          <>
            <div className={styles.icone} aria-hidden="true">
              <Icons.upload />
            </div>
            <h2 className={styles.titulo}>Atualização disponível</h2>
            <p className={styles.texto}>
              Uma nova versão da Torre{versao ? <> (<b className="numeric">v{versao}</b>)</> : null}{' '}
              está pronta. Quer atualizar agora? Leva menos de um minuto e a Torre reinicia
              sozinha.
            </p>
            <div className={styles.acoes}>
              <button
                type="button"
                className={styles.botaoSecundario}
                onClick={() => setFase('oculto')}
              >
                Depois
              </button>
              <button
                type="button"
                className={styles.botaoPrimario}
                onClick={() => {
                  setFase('baixando');
                  setProgresso(null);
                  window.torreUpdate?.startDownload();
                }}
              >
                <Icons.upload />
                Atualizar agora
              </button>
            </div>
          </>
        )}

        {fase === 'baixando' && (
          <>
            <div className={styles.icone} aria-hidden="true">
              <Icons.upload />
            </div>
            <h2 className={styles.titulo}>Baixando atualização…</h2>
            <div className={styles.barra}>
              <div className={styles.barraFill} style={{ width: `${pct}%` }} />
            </div>
            <div className={styles.progressoInfo}>
              <span className="numeric">{pct}%</span>
              <span className="numeric">
                {progresso ? formataVelocidade(progresso.bytesPerSecond) : '—'}
              </span>
              <span className="numeric">
                {progresso
                  ? `${formataMB(progresso.transferred)} / ${formataMB(progresso.total)}`
                  : ''}
              </span>
            </div>
            <p className={styles.textoDiscreto}>
              Não feche a Torre — ela reinicia sozinha quando terminar.
            </p>
          </>
        )}

        {fase === 'concluido' && (
          <>
            <div className={`${styles.icone} ${styles.iconeOk}`} aria-hidden="true">
              <Icons.check />
            </div>
            <h2 className={styles.titulo}>Atualização concluída</h2>
            <p className={styles.texto}>
              A atualização foi concluída. O aplicativo será reiniciado.
            </p>
          </>
        )}

        {fase === 'erro' && (
          <>
            <div className={`${styles.icone} ${styles.iconeErro}`} aria-hidden="true">
              <Icons.alert />
            </div>
            <h2 className={styles.titulo}>Não deu pra atualizar</h2>
            <p className={styles.texto}>{erro}</p>
            <div className={styles.acoes}>
              <button
                type="button"
                className={styles.botaoSecundario}
                onClick={() => setFase('oculto')}
              >
                Fechar
              </button>
              <button
                type="button"
                className={styles.botaoPrimario}
                onClick={() => {
                  setErro('');
                  setProgresso(null);
                  setFase('baixando');
                  window.torreUpdate?.startDownload();
                }}
              >
                <Icons.refresh />
                Tentar de novo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
