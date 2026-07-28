'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Icons } from '@/components/shell/icons';
import Badge from '@/components/ui/Badge';
import ui from '@/components/ui/ui.module.css';
import styles from './ConfiguracoesScreen.module.css';

interface ChipFreio {
  id: string;
  rotulo: string;
  intMin: number;
  intMax: number;
  rampa: number[];
  rampaDegrau: number;
  breakerLimite: number;
  loteMin: number;
  loteMax: number;
  pausaMin: number;
  pausaMax: number;
}

export default function ConfiguracoesScreen() {
  const [carregado, setCarregado] = useState(false);
  const [janelaIni, setJanelaIni] = useState('08:00');
  const [janelaFim, setJanelaFim] = useState('20:00');
  const [palavras, setPalavras] = useState(['sair', 'parar', 'descadastrar']);
  const [chips, setChips] = useState<ChipFreio[]>([]);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    fetch('/api/config', { cache: 'no-store' })
      .then((r) => r.json())
      .then((c) => {
        setJanelaIni(c.janelaIni);
        setJanelaFim(c.janelaFim);
        setPalavras(c.palavrasOptout);
        setChips(c.chips ?? []);
        setCarregado(true);
      })
      .catch(() => setCarregado(true));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarGlobal() {
    setSalvando(true);
    try {
      const r = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ janelaIni, janelaFim, palavrasOptout: palavras }),
      });
      if (r.ok) setSalvo(true);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <div>
          <p className="label">Freios</p>
          <h1 className={styles.title}>Configurações</h1>
          <p className={styles.desc}>
            Não são features. É o que mantém o chip vivo. Janela e opt-out valem
            pra todos os números; intervalo, rampa e breaker são <strong>por
            número</strong> — cada chip tem sua reputação.
          </p>
        </div>
      </header>

      <Secao
        icone={<Icons.relogio />}
        titulo="Janela horária · global"
        porque="Madrugada é o gesto mais denunciável que existe. Fora da janela, nada dispara — em nenhum número."
      >
        <div className={styles.linha}>
          <label className={styles.campo}>
            <span className="label">Início</span>
            <input
              type="time"
              className={styles.input}
              value={janelaIni}
              onChange={(e) => {
                setSalvo(false);
                setJanelaIni(e.target.value);
              }}
            />
          </label>
          <span className={styles.ate}>até</span>
          <label className={styles.campo}>
            <span className="label">Fim</span>
            <input
              type="time"
              className={styles.input}
              value={janelaFim}
              onChange={(e) => {
                setSalvo(false);
                setJanelaFim(e.target.value);
              }}
            />
          </label>
        </div>
      </Secao>

      <Secao
        icone={<Icons.power />}
        titulo="Opt-out · global"
        porque="Estas palavras removem o contato em definitivo, valendo pra todas as campanhas e todos os números."
      >
        <div className={styles.palavras}>
          {palavras.map((p) => (
            <span key={p} className={styles.palavra}>
              {p}
            </span>
          ))}
        </div>
        <p className={styles.rampaNota}>
          Remoção permanente e cross-campanha. Opt-out nunca volta para a fila.
        </p>
      </Secao>

      <footer className={styles.acoes}>
        {salvo && (
          <Badge tone="success" icone={<Icons.check />}>
            Global salvo
          </Badge>
        )}
        <button
          type="button"
          className={ui.botaoPrimario}
          disabled={salvando || !carregado}
          onClick={salvarGlobal}
        >
          {salvando ? 'Salvando…' : 'Salvar global'}
        </button>
      </footer>

      <div className={styles.head}>
        <p className="label">Por número</p>
        <p className={styles.desc}>
          Cada chip aquece sozinho. Suba a rampa e ajuste o intervalo de cada um
          conforme a idade e o comportamento do número.
        </p>
      </div>

      {chips.length === 0 ? (
        <section className={styles.secao}>
          <p className={styles.rampaNota}>
            Nenhum número ainda. Adicione um chip na tela <strong>Conexão</strong> —
            os freios dele aparecem aqui.
          </p>
        </section>
      ) : (
        chips.map((c) => <ChipFreios key={c.id} chip={c} onSalvo={carregar} />)
      )}
    </div>
  );
}

function ChipFreios({ chip, onSalvo }: { chip: ChipFreio; onSalvo: () => void }) {
  const [intMin, setIntMin] = useState(chip.intMin);
  const [intMax, setIntMax] = useState(chip.intMax);
  const [rampa, setRampa] = useState<number[]>(chip.rampa);
  const [degrau, setDegrau] = useState(chip.rampaDegrau);
  const [breaker, setBreaker] = useState(chip.breakerLimite);
  const [loteMin, setLoteMin] = useState(chip.loteMin);
  const [loteMax, setLoteMax] = useState(chip.loteMax);
  const [pausaMin, setPausaMin] = useState(chip.pausaMin);
  const [pausaMax, setPausaMax] = useState(chip.pausaMax);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const intervaloInvalido = intMin >= intMax;
  const loteInvalido = loteMin > loteMax || pausaMin > pausaMax;

  function mexeu<T>(setter: (v: T) => void) {
    return (v: T) => {
      setSalvo(false);
      setter(v);
    };
  }

  // Edita o teto de um degrau da rampa. Antes era só exibido; agora é o número
  // real que o worker usa como teto do dia (rampa[degrau]).
  function setTeto(i: number, v: number) {
    setSalvo(false);
    setRampa((prev) => prev.map((t, idx) => (idx === i ? Math.max(1, v || 1) : t)));
  }

  async function salvar() {
    setSalvando(true);
    try {
      const r = await fetch('/api/sessao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: chip.id,
          intMin,
          intMax,
          rampa,
          rampaDegrau: degrau,
          breakerLimite: breaker,
          loteMin,
          loteMax,
          pausaMin,
          pausaMax,
        }),
      });
      if (r.ok) {
        setSalvo(true);
        onSalvo();
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className={styles.secao}>
      <div className={styles.secaoHead}>
        <span className={styles.secaoIcone} aria-hidden="true">
          <Icons.qr />
        </span>
        <div>
          <h2 className={styles.secaoTitulo}>{chip.rotulo}</h2>
          <p className={styles.secaoPorque}>
            Intervalo aleatório, rampa e breaker próprios deste número.
          </p>
        </div>
      </div>
      <div className={styles.secaoCorpo}>
        <div className={styles.linha}>
          <label className={styles.campo}>
            <span className="label">Intervalo mín (s)</span>
            <input
              type="number"
              className={`${styles.input} numeric`}
              value={intMin}
              min={1}
              onChange={(e) => mexeu(setIntMin)(Number(e.target.value))}
            />
          </label>
          <span className={styles.ate}>–</span>
          <label className={styles.campo}>
            <span className="label">Intervalo máx (s)</span>
            <input
              type="number"
              className={`${styles.input} numeric`}
              value={intMax}
              min={1}
              onChange={(e) => mexeu(setIntMax)(Number(e.target.value))}
            />
          </label>
          <label className={styles.campo}>
            <span className="label">Breaker (falhas)</span>
            <input
              type="number"
              className={`${styles.input} ${styles.inputCurto} numeric`}
              value={breaker}
              min={1}
              onChange={(e) => mexeu(setBreaker)(Number(e.target.value))}
            />
          </label>
        </div>
        {intervaloInvalido && (
          <p className={styles.erroLinha}>
            <Icons.alert /> O mínimo precisa ser menor que o máximo.
          </p>
        )}

        <div className={styles.linha}>
          <label className={styles.campo}>
            <span className="label">Descanso a cada (disparos, mín)</span>
            <input
              type="number"
              className={`${styles.input} numeric`}
              value={loteMin}
              min={1}
              onChange={(e) => mexeu(setLoteMin)(Number(e.target.value))}
            />
          </label>
          <span className={styles.ate}>–</span>
          <label className={styles.campo}>
            <span className="label">máx</span>
            <input
              type="number"
              className={`${styles.input} numeric`}
              value={loteMax}
              min={1}
              onChange={(e) => mexeu(setLoteMax)(Number(e.target.value))}
            />
          </label>
          <label className={styles.campo}>
            <span className="label">Pausa (min, mín)</span>
            <input
              type="number"
              className={`${styles.input} numeric`}
              value={pausaMin}
              min={1}
              onChange={(e) => mexeu(setPausaMin)(Number(e.target.value))}
            />
          </label>
          <span className={styles.ate}>–</span>
          <label className={styles.campo}>
            <span className="label">máx</span>
            <input
              type="number"
              className={`${styles.input} numeric`}
              value={pausaMax}
              min={1}
              onChange={(e) => mexeu(setPausaMax)(Number(e.target.value))}
            />
          </label>
        </div>
        <p className={styles.rampaNota}>
          A cada <span className="numeric">{loteMin}</span>–
          <span className="numeric">{loteMax}</span> disparos, este número descansa{' '}
          <span className="numeric">{pausaMin}</span>–
          <span className="numeric">{pausaMax}</span> min. Rajada curta + descanso imita
          humano.
        </p>
        {loteInvalido && (
          <p className={styles.erroLinha}>
            <Icons.alert /> Cada mínimo precisa ser ≤ o máximo.
          </p>
        )}

        <div className={styles.rampa}>
          {rampa.map((teto, i) => (
            <div
              key={i}
              className={styles.degrau}
              data-ativo={i === degrau || undefined}
              data-passado={i < degrau || undefined}
              onClick={() => mexeu(setDegrau)(i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  mexeu(setDegrau)(i);
                }
              }}
            >
              <span className={styles.degrauDia}>Dia {i + 1}</span>
              <input
                type="number"
                min={1}
                className={`${styles.degrauInput} numeric`}
                value={teto}
                aria-label={`Teto do dia ${i + 1}`}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setTeto(i, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
        <p className={styles.rampaNota}>
          Clique num dia para marcar o degrau de hoje; o número é editável — é o teto
          real deste chip. Teto de hoje:{' '}
          <span className="numeric">{rampa[Math.min(degrau, rampa.length - 1)]}</span> mensagens.
        </p>

        <div className={styles.acoes}>
          {salvo && (
            <Badge tone="success" icone={<Icons.check />}>
              Salvo
            </Badge>
          )}
          <button
            type="button"
            className={ui.botaoPrimario}
            disabled={intervaloInvalido || loteInvalido || salvando}
            onClick={salvar}
          >
            {salvando ? 'Salvando…' : 'Salvar este número'}
          </button>
        </div>
      </div>
    </section>
  );
}

function Secao({
  icone,
  titulo,
  porque,
  children,
}: {
  icone: ReactNode;
  titulo: string;
  porque: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.secao}>
      <div className={styles.secaoHead}>
        <span className={styles.secaoIcone} aria-hidden="true">
          {icone}
        </span>
        <div>
          <h2 className={styles.secaoTitulo}>{titulo}</h2>
          <p className={styles.secaoPorque}>{porque}</p>
        </div>
      </div>
      <div className={styles.secaoCorpo}>{children}</div>
    </section>
  );
}
