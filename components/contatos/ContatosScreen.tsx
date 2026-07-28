'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Contato } from '@/lib/tipos';
import { Icons } from '@/components/shell/icons';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import EstadoVazio from '@/components/ui/EstadoVazio';
import EstadoErro from '@/components/ui/EstadoErro';
import ui from '@/components/ui/ui.module.css';
import styles from './ContatosScreen.module.css';

type Estado = 'carregando' | 'erro' | 'vazio' | 'cheio';

function StatusBadge({ status }: { status: Contato['status'] }) {
  return status === 'ativo' ? (
    <Badge tone="success" icone={<Icons.check />}>
      Ativo
    </Badge>
  ) : (
    <Badge tone="error" icone={<Icons.x />}>
      Opt-out
    </Badge>
  );
}

const ROTULO_TIPO: Record<Contato['tipo'], string> = {
  mobile: 'Celular',
  fixo: 'Fixo · sem WhatsApp',
  invalido: 'Inválido',
};

export default function ContatosScreen() {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [segmentos, setSegmentos] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [segmento, setSegmento] = useState('');
  const [importAberto, setImportAberto] = useState(false);
  // Seleção para exclusão em lote. `aExcluir` guarda os contatos que o modal de
  // confirmação vai apagar (um, pela lixeira da linha, ou os selecionados).
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [aExcluir, setAExcluir] = useState<Contato[] | null>(null);

  const carregar = useCallback(async () => {
    setEstado('carregando');
    try {
      const r = await fetch('/api/contatos', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setContatos(data.contatos);
      setSegmentos(data.segmentos);
      setSelecionados(new Set());
      setEstado(data.contatos.length ? 'cheio' : 'vazio');
    } catch {
      setEstado('erro');
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return contatos.filter((c) => {
      const casaBusca =
        !b ||
        c.nome.toLowerCase().includes(b) ||
        c.telefone.replace(/\D/g, '').includes(b.replace(/\D/g, ''));
      const casaSeg = !segmento || c.segmentos.includes(segmento);
      return casaBusca && casaSeg;
    });
  }, [contatos, busca, segmento]);

  const optouts = contatos.filter((c) => c.status === 'optout').length;
  const semZap = contatos.filter((c) => c.tipo !== 'mobile').length;

  // Seleção sempre restrita ao que está visível no filtro atual.
  const idsFiltrados = useMemo(() => filtrados.map((c) => c.id), [filtrados]);
  const selVisiveis = idsFiltrados.filter((id) => selecionados.has(id)).length;
  const todosSelecionados = idsFiltrados.length > 0 && selVisiveis === idsFiltrados.length;

  const alternar = useCallback((id: string) => {
    setSelecionados((prev) => {
      const prox = new Set(prev);
      if (prox.has(id)) prox.delete(id);
      else prox.add(id);
      return prox;
    });
  }, []);

  const alternarTodos = useCallback(() => {
    setSelecionados((prev) => {
      const prox = new Set(prev);
      const marcarTudo = !idsFiltrados.every((id) => prox.has(id));
      for (const id of idsFiltrados) {
        if (marcarTudo) prox.add(id);
        else prox.delete(id);
      }
      return prox;
    });
  }, [idsFiltrados]);

  const contatosSelecionados = useMemo(
    () => contatos.filter((c) => selecionados.has(c.id)),
    [contatos, selecionados],
  );

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <div>
          <p className="label">Base</p>
          <h1 className={styles.title}>Contatos</h1>
          <p className={styles.desc}>
            Base própria por planilha. Só celular recebe disparo — fixo é
            descartado na importação; inválido fica marcado e fora da fila.
          </p>
        </div>
        <button
          type="button"
          className={ui.botaoPrimario}
          onClick={() => setImportAberto(true)}
        >
          <Icons.upload />
          Importar planilha
        </button>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.buscaCampo}>
          <span className={styles.buscaIcone} aria-hidden="true">
            <Icons.busca />
          </span>
          <input
            className={styles.buscaInput}
            type="search"
            placeholder="Buscar por nome ou telefone"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            disabled={estado !== 'cheio'}
          />
        </div>
        <select
          className={styles.select}
          value={segmento}
          onChange={(e) => setSegmento(e.target.value)}
          disabled={estado !== 'cheio'}
          aria-label="Filtrar por segmento"
        >
          <option value="">Todos os segmentos</option>
          {segmentos.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {estado === 'carregando' && (
        <div className={styles.painel}>
          <Skeleton linhas={8} />
        </div>
      )}

      {estado === 'erro' && (
        <EstadoErro
          texto="Falha ao ler a base de contatos. Verifique o banco e tente de novo."
          onRetentar={carregar}
        />
      )}

      {estado === 'vazio' && (
        <EstadoVazio
          icone="contatos"
          titulo="Nenhum contato ainda"
          texto="Importe sua base por planilha (.xlsx). A origem e a data entram automáticas como prova de opt-in."
          acao={
            <button
              type="button"
              className={ui.botaoPrimario}
              onClick={() => setImportAberto(true)}
            >
              <Icons.upload />
              Importar planilha
            </button>
          }
        />
      )}

      {estado === 'cheio' && (
        <>
          {selVisiveis > 0 && (
            <div className={styles.selBar} role="status">
              <span className={styles.selInfo}>
                <span className="numeric">{selVisiveis}</span>{' '}
                {selVisiveis === 1 ? 'selecionado' : 'selecionados'}
              </span>
              <button
                type="button"
                className={styles.botaoLimpar}
                onClick={() => setSelecionados(new Set())}
              >
                Limpar seleção
              </button>
              <button
                type="button"
                className={styles.botaoPerigo}
                onClick={() => setAExcluir(contatosSelecionados)}
              >
                <Icons.lixeira />
                Excluir selecionados
              </button>
            </div>
          )}
          <div className={styles.tabelaWrap}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th className={styles.colCheck}>
                    <input
                      type="checkbox"
                      className={styles.check}
                      checked={todosSelecionados}
                      ref={(el) => {
                        if (el) el.indeterminate = selVisiveis > 0 && !todosSelecionados;
                      }}
                      onChange={alternarTodos}
                      aria-label="Selecionar todos os contatos visíveis"
                    />
                  </th>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Segmentos</th>
                  <th>Prova de opt-in</th>
                  <th>Cadastrado por</th>
                  <th>Status</th>
                  <th className={styles.colAcao} aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr
                    key={c.id}
                    data-optout={c.status === 'optout' || undefined}
                    data-sel={selecionados.has(c.id) || undefined}
                  >
                    <td className={styles.colCheck}>
                      <input
                        type="checkbox"
                        className={styles.check}
                        checked={selecionados.has(c.id)}
                        onChange={() => alternar(c.id)}
                        aria-label={`Selecionar ${c.nome}`}
                      />
                    </td>
                    <td className={styles.nome}>{c.nome}</td>
                    <td>
                      <span className={styles.telCel}>
                        <span className="numeric">{c.telefone}</span>
                        {c.tipo !== 'mobile' && (
                          <span className={styles.tipoTag} data-tipo={c.tipo}>
                            {ROTULO_TIPO[c.tipo]}
                          </span>
                        )}
                      </span>
                    </td>
                    <td>
                      <div className={styles.chips}>
                        {c.segmentos.map((s) => (
                          <span key={s} className={styles.chip}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.optinData} numeric`}>
                        {c.optIn.data ?? '—'}
                      </span>
                      <span className={styles.optinOrigem}>{c.optIn.origem ?? '—'}</span>
                    </td>
                    <td>{c.optIn.por ?? '—'}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td className={styles.colAcao}>
                      <button
                        type="button"
                        className={styles.botaoExcluir}
                        onClick={() => setAExcluir([c])}
                        aria-label={`Excluir ${c.nome}`}
                        title="Excluir contato"
                      >
                        <Icons.lixeira />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtrados.length === 0 && (
              <p className={styles.semResultado}>Nenhum contato para esse filtro.</p>
            )}
          </div>
          <p className={styles.rodape}>
            <span className="numeric">{filtrados.length}</span> de{' '}
            <span className="numeric">{contatos.length}</span> contatos ·{' '}
            <span className="numeric">{optouts}</span> em opt-out ·{' '}
            <span className="numeric">{semZap}</span> sem WhatsApp
          </p>
        </>
      )}

      {importAberto && (
        <ImportModal
          onFechar={() => setImportAberto(false)}
          onImportado={carregar}
        />
      )}

      {aExcluir && (
        <ConfirmarExclusao
          contatos={aExcluir}
          onFechar={() => setAExcluir(null)}
          onExcluido={carregar}
        />
      )}
    </div>
  );
}

function ConfirmarExclusao({
  contatos,
  onFechar,
  onExcluido,
}: {
  contatos: Contato[];
  onFechar: () => void;
  onExcluido: () => void;
}) {
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const n = contatos.length;
  const umSo = n === 1;

  async function confirmar() {
    setExcluindo(true);
    setErro(null);
    try {
      const r = await fetch('/api/contatos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: contatos.map((c) => c.id) }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(data.erro ?? 'Falha ao excluir.');
        return;
      }
      onExcluido();
      onFechar();
    } catch {
      setErro('Falha de rede ao excluir.');
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar exclusão"
    >
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitulo}>
            Excluir {umSo ? 'contato' : `${n} contatos`}?
          </h2>
          <button
            type="button"
            className={ui.botaoFantasma}
            onClick={onFechar}
            aria-label="Fechar"
          >
            <Icons.x />
          </button>
        </div>

        <p className={styles.modalTexto}>
          {umSo ? (
            <>
              <strong>{contatos[0].nome}</strong> (
              <span className="numeric">{contatos[0].telefone}</span>) será removido em
              definitivo da base.
            </>
          ) : (
            <>
              <strong>{n}</strong> contatos serão removidos em definitivo da base.
            </>
          )}{' '}
          A exclusão é permanente e apaga junto os disparos ligados a{' '}
          {umSo ? 'ele' : 'eles'} — inclusive de campanhas já rodadas (somem do
          relatório). Não dá pra desfazer.
        </p>

        {n > 1 && n <= 12 && (
          <ul className={styles.listaExcluir}>
            {contatos.map((c) => (
              <li key={c.id}>
                {c.nome} · <span className="numeric">{c.telefone}</span>
              </li>
            ))}
          </ul>
        )}

        {erro && (
          <p className={styles.erroModal}>
            <Icons.alert /> {erro}
          </p>
        )}

        <div className={styles.modalAcoes}>
          <button type="button" className={ui.botao} onClick={onFechar} disabled={excluindo}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.botaoPerigo}
            onClick={confirmar}
            disabled={excluindo}
          >
            <Icons.lixeira />
            {excluindo ? 'Excluindo…' : umSo ? 'Excluir contato' : `Excluir ${n}`}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Resumo {
  linhas: number;
  importados: number;
  atualizados: number;
  semTelefone: number;
  duplicadosNoArquivo: number;
  mobiles: number;
  fixos: number;
  invalidos: number;
}

function ImportModal({
  onFechar,
  onImportado,
}: {
  onFechar: () => void;
  onImportado: () => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [segmento, setSegmento] = useState('');
  const [cidade, setCidade] = useState('');
  const [nicho, setNicho] = useState('');
  const [por, setPor] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function processar() {
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      if (segmento.trim()) fd.append('segmento', segmento.trim());
      if (cidade.trim()) fd.append('cidade', cidade.trim());
      if (nicho.trim()) fd.append('nicho', nicho.trim());
      if (por.trim()) fd.append('por', por.trim());
      const r = await fetch('/api/contatos/import', { method: 'POST', body: fd });
      const data = await r.json();
      if (!r.ok) {
        setErro(data.erro ?? 'Falha ao importar.');
        return;
      }
      setResumo(data.resumo);
      onImportado();
    } catch {
      setErro('Falha de rede ao enviar a planilha.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Importar planilha">
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitulo}>Importar contatos por planilha</h2>
          <button
            type="button"
            className={ui.botaoFantasma}
            onClick={onFechar}
            aria-label="Fechar"
          >
            <Icons.x />
          </button>
        </div>

        {resumo ? (
          <>
            <p className={styles.modalTexto}>Importação concluída.</p>
            <div className={styles.resumo}>
              <span className={styles.resumoItem}>
                Novos <b>{resumo.importados}</b>
              </span>
              <span className={styles.resumoItem}>
                Atualizados <b>{resumo.atualizados}</b>
              </span>
              <span className={styles.resumoItem}>
                Celulares <b>{resumo.mobiles}</b>
              </span>
              <span className={styles.resumoItem}>
                Fixos descartados <b>{resumo.fixos}</b>
              </span>
              <span className={styles.resumoItem}>
                Inválidos <b>{resumo.invalidos}</b>
              </span>
              <span className={styles.resumoItem}>
                Duplicados no arquivo <b>{resumo.duplicadosNoArquivo}</b>
              </span>
              <span className={styles.resumoItem}>
                Sem telefone <b>{resumo.semTelefone}</b>
              </span>
              <span className={styles.resumoItem}>
                Linhas lidas <b>{resumo.linhas}</b>
              </span>
            </div>
            <div className={styles.modalAcoes}>
              <button type="button" className={ui.botaoPrimario} onClick={onFechar}>
                Fechar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.modalTexto}>
              Preciso da coluna <strong>Nome</strong> e da coluna{' '}
              <strong>Telefone</strong> (aceito também Celular / WhatsApp / Fone).
              Colunas <strong>Cidade</strong> e <strong>Nicho</strong>, se houver, são
              lidas; senão valem os campos abaixo. Origem e data entram automáticas.
            </p>

            <label className={styles.dropzone} htmlFor="arquivo-xlsx">
              <Icons.upload />
              {arquivo ? (
                <span className={styles.arquivoNome}>{arquivo.name}</span>
              ) : (
                <span>Clique para escolher a planilha (.xlsx)</span>
              )}
              <span className={styles.dropzoneNota}>
                Fixo é descartado (não tem WhatsApp). Inválido é importado, mas não entra em campanha.
              </span>
              <input
                id="arquivo-xlsx"
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={(e) => {
                  setArquivo(e.target.files?.[0] ?? null);
                  setErro(null);
                }}
              />
            </label>

            <label className={styles.campoModal}>
              <span className="label">Segmento (opcional — aplica a todos)</span>
              <input
                className={styles.inputModal}
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                placeholder="Ex.: Lanches Canoas"
              />
            </label>
            <label className={styles.campoModal}>
              <span className="label">
                Cidade do lote (opcional — vira {'{{cidade}}'} na mensagem)
              </span>
              <input
                className={styles.inputModal}
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex.: Uberlândia"
              />
            </label>
            <label className={styles.campoModal}>
              <span className="label">
                Nicho do lote (opcional — vira {'{{nicho}}'} na mensagem)
              </span>
              <input
                className={styles.inputModal}
                value={nicho}
                onChange={(e) => setNicho(e.target.value)}
                placeholder="Ex.: barbearia"
              />
            </label>
            <label className={styles.campoModal}>
              <span className="label">Cadastrado por (opcional)</span>
              <input
                className={styles.inputModal}
                value={por}
                onChange={(e) => setPor(e.target.value)}
                placeholder="Seu nome"
              />
            </label>

            {erro && (
              <p className={styles.erroModal}>
                <Icons.alert /> {erro}
              </p>
            )}

            <div className={styles.modalAcoes}>
              <button type="button" className={ui.botao} onClick={onFechar}>
                Cancelar
              </button>
              <button
                type="button"
                className={ui.botaoPrimario}
                disabled={!arquivo || enviando}
                onClick={processar}
              >
                {enviando ? 'Processando…' : 'Processar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
