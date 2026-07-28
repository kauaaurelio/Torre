'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Contato, SessaoResumo } from '@/lib/tipos';
import { contaCombinacoes, renderiza } from '@/lib/variacao';
import { Icons } from '@/components/shell/icons';
import ui from '@/components/ui/ui.module.css';
import styles from './NovaCampanhaScreen.module.css';

const MODELO_INICIAL = `{{saudacao}}! Aqui é o Kauã, {sou de|também sou de} {{cidade}}

{Vi|Encontrei} {{#se empresa}}a {{empresa}}{{/se}}{{#sem empresa}}vocês{{/sem}} {pesquisando|procurando} {{nicho}} em {{cidade}}, trabalho {muito bom|de primeira}

Fui {procurar o|atrás do} site de vocês e não achei, só o Instagram. Acabei montando uma versão de como ele {podia|poderia} ser, já com a cara de vocês

{Tá|Está} pronta, sem compromisso. Posso mandar pra {darem uma olhada|vocês verem}?`;

const VARIAVEIS = [
  { token: '{{saudacao}}', rotulo: 'saudação por horário (Bom dia/tarde/noite)' },
  { token: '{{primeiro_nome}}', rotulo: 'primeiro nome' },
  { token: '{{nome}}', rotulo: 'nome completo' },
  { token: '{{empresa}}', rotulo: 'nome da empresa (padrão: o nome do contato)' },
  { token: '{{cidade}}', rotulo: 'cidade' },
  { token: '{{nicho}}', rotulo: 'nicho' },
  { token: '{{segmento}}', rotulo: 'segmento' },
];

export default function NovaCampanhaScreen() {
  const router = useRouter();
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [segmentos, setSegmentos] = useState<string[]>([]);
  const [sessoes, setSessoes] = useState<SessaoResumo[]>([]);
  const [nome, setNome] = useState('Reativação · Agosto');
  const [segmento, setSegmento] = useState('');
  const [numeroId, setNumeroId] = useState(''); // '' = rodízio entre os conectados
  const [msg, setMsg] = useState(MODELO_INICIAL);
  const [seed, setSeed] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/contatos', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setContatos(d.contatos ?? []);
        setSegmentos(d.segmentos ?? []);
      })
      .catch(() => {});
    fetch('/api/estado', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setSessoes(d.sessoes ?? []))
      .catch(() => {});
  }, []);

  // Elegíveis: celular ativo (só quem tem WhatsApp e não deu opt-out).
  const elegiveis = useMemo(
    () =>
      contatos.filter(
        (c) =>
          c.status === 'ativo' &&
          c.tipo === 'mobile' &&
          (!segmento || c.segmentos.includes(segmento)),
      ),
    [contatos, segmento],
  );
  const destinatarios = elegiveis.length;

  const combos = useMemo(() => contaCombinacoes(msg), [msg]);
  const amostra = elegiveis[0] ?? contatos[0] ?? null;
  const nomeAmostra = amostra?.nome ?? 'Contato';
  const preview = useMemo(
    () =>
      renderiza(
        msg,
        seed,
        {
          nome: nomeAmostra,
          segmento: amostra?.segmentos[0] ?? null,
          // Placeholders só na prévia, pra não ficar buraco quando o contato de
          // amostra ainda não tem o dado. No disparo real vale o dado do contato.
          cidade: amostra?.cidade ?? 'sua cidade',
          nicho: amostra?.nicho ?? 'seu nicho',
          empresa: amostra?.empresa ?? amostra?.nome ?? null,
        },
        new Date(), // resolve {{saudacao}} pela hora atual na prévia
      ),
    [msg, seed, nomeAmostra, amostra],
  );

  function inserir(token: string) {
    const area = areaRef.current;
    if (!area) {
      setMsg((m) => m + token);
      return;
    }
    const ini = area.selectionStart;
    const fim = area.selectionEnd;
    setMsg((m) => m.slice(0, ini) + token + m.slice(fim));
    requestAnimationFrame(() => {
      area.focus();
      const pos = ini + token.length;
      area.setSelectionRange(pos, pos);
    });
  }

  const conectados = sessoes.filter((s) => s.estadoRaw === 'conectado');
  // Precisa de um chip pra escoar: o número fixo escolhido, ou (rodízio) ao
  // menos um conectado.
  const numeroPronto = numeroId
    ? sessoes.some((s) => s.id === numeroId && s.estadoRaw === 'conectado')
    : conectados.length > 0;
  const podeAgendar =
    destinatarios > 0 && msg.trim().length > 0 && combos >= 2 && numeroPronto && !enviando;

  const agendar = useCallback(async () => {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch('/api/campanhas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          segmento: segmento || null,
          template: msg,
          numeroId: numeroId || null,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErro(data.erro ?? 'Falha ao agendar.');
        return;
      }
      router.push('/fila');
    } catch {
      setErro('Falha de rede ao agendar a campanha.');
    } finally {
      setEnviando(false);
    }
  }, [nome, segmento, msg, numeroId, router]);

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <p className="label">Disparo</p>
        <h1 className={styles.title}>Nova campanha</h1>
        <p className={styles.desc}>
          Cada contato recebe uma combinação diferente do texto. Variação é freio,
          não enfeite: texto fixo é assinatura de bot.
        </p>
      </header>

      <div className={styles.linhaTopo}>
        <label className={styles.campo}>
          <span className="label">Nome da campanha</span>
          <input
            className={styles.input}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Reativação · Agosto"
          />
        </label>
        <label className={styles.campo}>
          <span className="label">Segmento alvo</span>
          <select
            className={styles.select}
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
          >
            <option value="">Base inteira</option>
            {segmentos.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.campo}>
          <span className="label">Número de envio</span>
          <select
            className={styles.select}
            value={numeroId}
            onChange={(e) => setNumeroId(e.target.value)}
          >
            <option value="">Rodízio (todos conectados)</option>
            {sessoes.map((s) => (
              <option key={s.id} value={s.id} disabled={s.estadoRaw !== 'conectado'}>
                {s.rotulo}
                {s.numero ? ` · ${s.numero}` : ''}
                {s.estadoRaw !== 'conectado' ? ' (offline)' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.campo}>
          <span className="label">Destinatários</span>
          <span className={`${styles.destaque} numeric`}>
            {destinatarios}
            <span className={styles.destaqueNota}>celular ativo</span>
          </span>
        </div>
      </div>

      <div className={styles.editorGrid}>
        <section className={styles.editorCol}>
          <div className={styles.palette}>
            <span className="label">Inserir</span>
            {VARIAVEIS.map((v) => (
              <button
                key={v.token}
                type="button"
                className={styles.varBtn}
                onClick={() => inserir(v.token)}
                title={`Inserir ${v.rotulo}`}
              >
                {v.token}
              </button>
            ))}
            <button
              type="button"
              className={styles.varBtn}
              onClick={() => inserir('{opção A|opção B}')}
              title="Inserir bloco de variação"
            >
              {'{a|b}'}
            </button>
            <button
              type="button"
              className={styles.varBtn}
              onClick={() => inserir('{{primeiro_nome|cliente}}')}
              title="Variável com valor-padrão: se o contato não tem o dado, usa o padrão"
            >
              {'{{x|padrão}}'}
            </button>
            <button
              type="button"
              className={styles.varBtn}
              onClick={() => inserir('{{#se empresa}}texto{{/se}}')}
              title="Bloco condicional: só aparece quando o campo tem valor"
            >
              {'{{#se}}'}
            </button>
          </div>
          <textarea
            ref={areaRef}
            className={styles.textarea}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            spellCheck={false}
            aria-label="Texto da mensagem"
          />
          <div className={styles.editorRodape}>
            <span className={`${styles.contador} numeric`}>
              {preview.length} caracteres na amostra
            </span>
            <span className={`${styles.contador} numeric`}>
              {combos} combinaç{combos === 1 ? 'ão' : 'ões'}
            </span>
          </div>
          {combos < 2 && (
            <aside className={styles.aviso} data-tone="warning">
              <span aria-hidden="true">
                <Icons.alert />
              </span>
              <p>
                Sem variação, todos recebem o texto idêntico — o padrão mais
                denunciável que existe. Adicione ao menos um bloco{' '}
                <code>{'{a|b}'}</code>.
              </p>
            </aside>
          )}
        </section>

        <section className={styles.previewCol}>
          <div className={styles.previewHead}>
            <span className="label">Prévia · {nomeAmostra}</span>
            <button
              type="button"
              className={ui.botaoFantasma}
              onClick={() => setSeed((s) => s + 1)}
              title="Ver outra combinação"
            >
              <Icons.refresh />
              Outra
            </button>
          </div>
          <div className={styles.bolha}>
            {preview.split('\n').map((linha, i) => (
              <p key={i} className={styles.bolhaLinha}>
                {linha || ' '}
              </p>
            ))}
          </div>
        </section>
      </div>

      <footer className={styles.acoes}>
        <p className={styles.acaoNota}>
          {erro ? (
            <span className={styles.acaoErro}>
              <Icons.alert /> {erro}
            </span>
          ) : !numeroPronto ? (
            <span className={styles.acaoErro}>
              <Icons.alert /> Nenhum número {numeroId ? 'escolhido está' : ''} conectado. Pareie um
              chip na tela Conexão antes de agendar.
            </span>
          ) : (
            'O disparo entra na fila com intervalo aleatório e respeita a janela horária e a rampa (por número).'
          )}
        </p>
        <button
          type="button"
          className={ui.botaoPrimario}
          disabled={!podeAgendar}
          onClick={agendar}
        >
          <Icons.enviar />
          {enviando ? 'Agendando…' : 'Agendar disparo'}
        </button>
      </footer>
    </div>
  );
}
