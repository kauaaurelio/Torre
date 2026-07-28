'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EstadoModulo } from '@/lib/tipos';
import Badge from '@/components/ui/Badge';
import EstadoVazio from '@/components/ui/EstadoVazio';
import EstadoErro from '@/components/ui/EstadoErro';
import Skeleton from '@/components/ui/Skeleton';
import { Icons } from '@/components/shell/icons';
import ui from '@/components/ui/ui.module.css';
import styles from './RelatorioScreen.module.css';

interface RelData {
  campanha: {
    id: string;
    nome: string;
    status: string;
    total: number;
    contagem: Record<EstadoModulo, number>;
  } | null;
}

const FAIXAS = [
  { chave: 'entregue', rotulo: 'Entregue', tone: 'success' as const, icone: <Icons.check /> },
  { chave: 'falhou', rotulo: 'Falhou', tone: 'error' as const, icone: <Icons.x /> },
  { chave: 'optout', rotulo: 'Opt-out', tone: 'neutral' as const, icone: <Icons.power /> },
  { chave: 'pendente', rotulo: 'Pendente', tone: 'neutral' as const, icone: <Icons.relogio /> },
];

export default function RelatorioScreen() {
  const [data, setData] = useState<RelData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/relatorio', { cache: 'no-store' });
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
    const t = setInterval(carregar, 4000);
    return () => clearInterval(t);
  }, [carregar]);

  const camp = data?.campanha ?? null;

  const dados = useMemo(() => {
    const c = camp?.contagem ?? { fila: 0, enviando: 0, entregue: 0, falhou: 0, optout: 0 };
    const pendente = c.fila + c.enviando;
    const enviados = c.entregue + c.falhou;
    const taxa = enviados ? Math.round((c.entregue / enviados) * 100) : 0;
    return {
      ...c,
      pendente,
      enviados,
      taxa,
      total: camp?.total ?? 0,
      partes: { entregue: c.entregue, falhou: c.falhou, optout: c.optout, pendente },
    };
  }, [camp]);

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <div>
          <p className="label">Resultado</p>
          <h1 className={styles.title}>Relatório</h1>
          <p className={styles.desc}>{camp?.nome ?? 'Campanha'}</p>
        </div>
      </header>

      {carregando && (
        <div className={styles.painel}>
          <Skeleton linhas={5} />
        </div>
      )}

      {!carregando && erro && (
        <EstadoErro
          texto="Falha ao carregar os números da campanha. Tente de novo."
          onRetentar={carregar}
        />
      )}

      {!carregando && !erro && !camp && (
        <EstadoVazio
          icone="report"
          titulo="Nenhuma campanha concluída"
          texto="Assim que um disparo rodar, a taxa de entrega e o detalhamento aparecem aqui."
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
          <section className={styles.heroi}>
            <div className={styles.heroiTopo}>
              <span className="label">Taxa de entrega</span>
              <span className={styles.heroiSub}>
                <span className="numeric">{dados.entregue}</span> de{' '}
                <span className="numeric">{dados.enviados}</span> envios
              </span>
            </div>
            <div className={styles.heroiValor}>
              <span className={`${styles.taxaNum} numeric`}>{dados.taxa}</span>
              <span className={styles.taxaPct}>%</span>
            </div>
            <div
              className={styles.medidor}
              role="img"
              aria-label={`Taxa de entrega ${dados.taxa} por cento`}
            >
              <div
                className={styles.medidorPreenchido}
                style={{ inlineSize: `${dados.taxa}%` }}
              />
            </div>
          </section>

          <div className={styles.tiles}>
            <Tile rotulo="Enviados" valor={dados.enviados} />
            <Tile rotulo="Entregue" valor={dados.entregue} tone="success" />
            <Tile rotulo="Falhou" valor={dados.falhou} tone="error" />
            <Tile rotulo="Opt-out" valor={dados.optout} tone="neutral" />
          </div>

          <section className={styles.composicao}>
            <div className={styles.compHead}>
              <span className="label">Composição</span>
              <span className={styles.compTotal}>
                <span className="numeric">{dados.total}</span> contatos
              </span>
            </div>
            <div className={styles.barra}>
              {FAIXAS.map((f) => {
                const n = dados.partes[f.chave as keyof typeof dados.partes];
                const pct = dados.total ? (n / dados.total) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={f.chave}
                    className={styles.segmento}
                    data-faixa={f.chave}
                    style={{ inlineSize: `${pct}%` }}
                    title={`${f.rotulo}: ${n} (${Math.round(pct)}%)`}
                  />
                );
              })}
            </div>
            <ul className={styles.legenda}>
              {FAIXAS.map((f) => {
                const n = dados.partes[f.chave as keyof typeof dados.partes];
                return (
                  <li key={f.chave} className={styles.legendaItem}>
                    <Badge tone={f.tone} icone={f.icone}>
                      {f.rotulo}
                    </Badge>
                    <span className={`${styles.legendaN} numeric`}>{n}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Tile({
  rotulo,
  valor,
  tone,
}: {
  rotulo: string;
  valor: number;
  tone?: 'success' | 'error' | 'neutral';
}) {
  return (
    <div className={styles.tile}>
      <span className="label">{rotulo}</span>
      <span className={`${styles.tileValor} numeric`} data-tone={tone}>
        {valor}
      </span>
    </div>
  );
}
