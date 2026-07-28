'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { EstadoModulo } from '@/lib/tipos';
import Fita from '@/components/shell/Fita';
import Badge from '@/components/ui/Badge';
import EstadoVazio from '@/components/ui/EstadoVazio';
import EstadoErro from '@/components/ui/EstadoErro';
import Skeleton from '@/components/ui/Skeleton';
import { Icons } from '@/components/shell/icons';
import ui from '@/components/ui/ui.module.css';
import styles from './FilaScreen.module.css';

interface FilaData {
  campanha: {
    id: string;
    nome: string;
    status: string;
    total: number;
    motivoPausa: string | null;
    modulos: EstadoModulo[];
    contagem: Record<EstadoModulo, number>;
  } | null;
  freios?: {
    intMin: number;
    intMax: number;
    rampa: number[];
    tetoHoje: number;
    enviadosHoje: number;
  };
}

const LEGENDA: { estado: EstadoModulo; rotulo: string }[] = [
  { estado: 'fila', rotulo: 'Na fila' },
  { estado: 'enviando', rotulo: 'Enviando' },
  { estado: 'entregue', rotulo: 'Entregue' },
  { estado: 'falhou', rotulo: 'Falhou' },
  { estado: 'optout', rotulo: 'Opt-out' },
];

export default function FilaScreen() {
  const [data, setData] = useState<FilaData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [agindo, setAgindo] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/fila', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      setData(await r.json());
      setErro(false);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 3000);
    return () => clearInterval(t);
  }, [carregar]);

  const controle = useCallback(
    async (acao: 'pausar' | 'retomar') => {
      if (!data?.campanha) return;
      setAgindo(true);
      try {
        await fetch(`/api/campanhas/${data.campanha.id}/controle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao }),
        });
        await carregar();
      } finally {
        setAgindo(false);
      }
    },
    [data, carregar],
  );

  const camp = data?.campanha ?? null;
  const c = camp?.contagem;
  const concluidos = c ? c.entregue + c.falhou + c.optout : 0;
  const enviados = c ? c.entregue + c.falhou : 0;
  const taxa = enviados ? Math.round(((c?.entregue ?? 0) / enviados) * 100) : 0;
  const breaker =
    camp?.status === 'pausada' && (camp.motivoPausa ?? '').startsWith('Circuit breaker');

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <p className="label">Operação</p>
        <h1 className={styles.title}>Fila</h1>
        <p className={styles.desc}>
          A fila renderizada módulo a módulo: barra de progresso e mapa da
          campanha ao mesmo tempo.
        </p>
      </header>

      {carregando && (
        <div className={styles.painel}>
          <Skeleton linhas={6} />
        </div>
      )}

      {!carregando && erro && (
        <EstadoErro
          texto="Falha ao ler a fila. Verifique se o banco está de pé."
          onRetentar={carregar}
        />
      )}

      {!carregando && !erro && !camp && (
        <EstadoVazio
          icone="tape"
          titulo="Nenhuma campanha na fila"
          texto="Monte uma campanha e agende o disparo para ver a fita rodar aqui."
          acao={
            <Link href="/nova-campanha" className={ui.botaoPrimario}>
              <Icons.compose />
              Nova campanha
            </Link>
          }
        />
      )}

      {!carregando && !erro && camp && (
        <>
          <div className={styles.controles}>
            <div className={styles.controlesInfo}>
              <span className={styles.campNome}>{camp.nome}</span>
              {camp.status === 'rodando' ? (
                <Badge tone="warning" icone={<Icons.play />}>
                  Rodando
                </Badge>
              ) : camp.status === 'concluida' ? (
                <Badge tone="success" icone={<Icons.check />}>
                  Concluída
                </Badge>
              ) : breaker ? (
                <Badge tone="error" icone={<Icons.alert />}>
                  Circuit breaker
                </Badge>
              ) : (
                <Badge tone="info" icone={<Icons.pausa />}>
                  Pausada
                </Badge>
              )}
            </div>
            {(camp.status === 'rodando' || camp.status === 'pausada') && (
              <button
                type="button"
                className={ui.botao}
                disabled={agindo}
                onClick={() => controle(camp.status === 'rodando' ? 'pausar' : 'retomar')}
              >
                {camp.status === 'rodando' ? <Icons.pausa /> : <Icons.play />}
                {camp.status === 'rodando' ? 'Pausar' : 'Retomar'}
              </button>
            )}
          </div>

          {breaker && (
            <EstadoErro
              titulo="Fila pausada pelo circuit breaker"
              texto={
                (camp.motivoPausa ?? '') +
                '. Verifique o número e a conexão antes de retomar — insistir com o chip instável é o caminho do banimento.'
              }
              onRetentar={() => controle('retomar')}
            />
          )}

          <div className={styles.metricas}>
            <Metrica rotulo="Progresso" valor={`${concluidos}/${camp.total}`} />
            <Metrica rotulo="Taxa de entrega" valor={`${taxa}%`} destaque />
            <Metrica
              rotulo="Enviados hoje"
              valor={`${data?.freios?.enviadosHoje ?? 0}`}
              nota={`teto ${data?.freios?.tetoHoje ?? '—'}`}
            />
            <Metrica
              rotulo="Intervalo"
              valor={`${data?.freios?.intMin ?? '—'}–${data?.freios?.intMax ?? '—'}s`}
            />
            <Metrica
              rotulo="Rampa"
              valor={`${data?.freios?.tetoHoje ?? '—'}`}
              nota={(data?.freios?.rampa ?? []).join('→')}
            />
          </div>

          <div className={styles.fitaCartao}>
            <Fita modulos={camp.modulos} className={styles.fitaGrande} />
          </div>

          <ul className={styles.legenda}>
            {LEGENDA.map((l) => (
              <li key={l.estado} className={styles.legendaItem}>
                <span
                  className="fita__modulo"
                  {...(l.estado !== 'fila' ? { 'data-estado': l.estado } : {})}
                />
                {l.rotulo}
                <span className={`${styles.legendaN} numeric`}>{c?.[l.estado] ?? 0}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Metrica({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  destaque?: boolean;
}) {
  return (
    <div className={styles.metrica}>
      <span className="label">{rotulo}</span>
      <span
        className={`${styles.metricaValor} numeric`}
        data-destaque={destaque || undefined}
      >
        {valor}
      </span>
      {nota && <span className={styles.metricaNota}>{nota}</span>}
    </div>
  );
}
