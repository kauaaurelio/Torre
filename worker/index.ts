// Torre — worker Baileys MULTI-NÚMERO. Processo VIVO e separado do painel: um só
// worker segura N sockets, um por chip. Escreve o estado de cada sessão no SQLite
// (o painel lê) e roda o loop de envio respeitando os freios — que agora são POR
// NÚMERO (cada chip tem sua rampa, seu teto, seu intervalo, seu breaker).
//
// Rodar:  npm run worker
// Cada sessão tem sua pasta .baileys/<id>  ·  não versionar (identidade do chip).

import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  type WASocket,
  type proto,
} from 'baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { normalizaTelefone } from '../lib/telefone';
import { saudacaoDe } from '../lib/variacao';

const prisma = new PrismaClient({ log: ['warn', 'error'] });
const logger = pino({ level: 'silent' });

function authDir(sessaoId: string) {
  return `.baileys/${sessaoId}`;
}

// Runtime em memória, por sessão. O estado durável vive no SQLite; isto é só o
// que não faz sentido persistir (socket, contadores voláteis).
interface RT {
  sock: WASocket | null;
  conectado: boolean;
  temCreds: boolean;
  breaker: boolean; // pausado por falhas — pula o envio até reconectar
  falhasSeguidas: number;
  proximoEnvioEm: number; // intervalo curto normal (usado pelo loop FIXO deste chip)
  descansoAte: number; // descanso em lote (rest longo) — exclui o chip de tudo
  ocupado: boolean; // trava de reentrância do envio, por sessão
  qrCount: number;
  enviadosNoLote: number; // disparos desde o último descanso longo
  loteAlvo: number | null; // tamanho do lote atual (aleatório), fixado no início
}
const rts = new Map<string, RT>();

// Rodízio: um só cadenciador que GIRA entre os chips elegíveis — um manda, o
// próximo manda, o próximo… não um até o teto e depois o outro. A cadência
// (intervalo entre disparos de rodízio) é compartilhada; a rotação é justa.
let rodizioProximoEm = 0; // quando o próximo disparo de rodízio pode sair
let rodizioGiro = 0; // ponteiro de rotação (incrementa a cada disparo de rodízio)

function rt(sessaoId: string): RT {
  let r = rts.get(sessaoId);
  if (!r) {
    r = {
      sock: null,
      conectado: false,
      temCreds: false,
      breaker: false,
      falhasSeguidas: 0,
      proximoEnvioEm: 0,
      descansoAte: 0,
      ocupado: false,
      qrCount: 0,
      enviadosNoLote: 0,
      loteAlvo: null,
    };
    rts.set(sessaoId, r);
  }
  return r;
}

// Versão do protocolo: busca uma vez e reusa em todos os sockets.
let versaoCache: Awaited<ReturnType<typeof fetchLatestBaileysVersion>>['version'] | null = null;
async function versaoProtocolo() {
  if (!versaoCache) versaoCache = (await fetchLatestBaileysVersion()).version;
  return versaoCache;
}

// ---------- helpers de estado ----------
async function setSessao(sessaoId: string, data: Record<string, unknown>) {
  await prisma.sessao.update({ where: { id: sessaoId }, data }).catch(() => {});
}

async function garanteSingletons() {
  await prisma.config.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  await prisma.worker.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

function jidParaExibicao(jid: string): string {
  const num = jid.split('@')[0].split(':')[0];
  return normalizaTelefone(num).exibicao;
}

function extraiTexto(m: proto.IMessage | null | undefined): string {
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  );
}

// {{saudacao}} fica sem resolver no enfileiramento (o texto é materializado horas
// antes). Resolve aqui, na hora REAL do envio, pela hora atual.
function resolveSaudacao(texto: string): string {
  return texto.replace(/\{\{\s*saudacao\s*\}\}/g, saudacaoDe(new Date()));
}

// ---------- socket, por sessão ----------
async function iniciarSocket(sessaoId: string) {
  const r = rt(sessaoId);
  if (r.sock) {
    try {
      r.sock.ev.removeAllListeners('connection.update');
      r.sock.ev.removeAllListeners('messages.upsert');
      r.sock.end(undefined);
    } catch {}
    r.sock = null;
  }

  r.qrCount = 0;
  const { state, saveCreds } = await useMultiFileAuthState(authDir(sessaoId));
  r.temCreds = Boolean(state.creds?.registered);
  const version = await versaoProtocolo();

  r.sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.appropriate('Torre'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  r.sock.ev.on('creds.update', saveCreds);
  r.sock.ev.on('connection.update', (u) => onConexao(sessaoId, u));
  r.sock.ev.on('messages.upsert', onMensagens);
}

async function onConexao(
  sessaoId: string,
  u: { connection?: string; lastDisconnect?: { error?: unknown }; qr?: string },
) {
  const r = rt(sessaoId);
  const { connection, lastDisconnect, qr } = u;

  if (qr) {
    const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
    await setSessao(sessaoId, { estado: 'aguardando_leitura', qr: dataUrl, motivo: null });
    r.qrCount += 1;
    if (r.qrCount === 1) {
      console.log(`[torre] QR pronto (${sessaoId}) — abra Conexão e escaneie com o chip.`);
    }
  }

  if (connection === 'connecting' && r.temCreds) {
    await setSessao(sessaoId, { estado: 'conectando' });
  }

  if (connection === 'open') {
    r.conectado = true;
    r.temCreds = true;
    r.breaker = false;
    r.falhasSeguidas = 0;
    const numero = r.sock?.user?.id ? jidParaExibicao(r.sock.user.id) : null;
    await setSessao(sessaoId, { estado: 'conectado', numero, qr: null, motivo: null });
    console.log('[torre] conectado', sessaoId, 'como', numero);
  }

  if (connection === 'close') {
    r.conectado = false;
    const code = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
      ?.output?.statusCode;

    if (code === DisconnectReason.loggedOut) {
      await limparAuth(sessaoId);
      await setSessao(sessaoId, {
        estado: 'sem_sessao',
        numero: null,
        qr: null,
        motivo: 'Sessão encerrada.',
      });
      console.log('[torre] logout', sessaoId, '— credenciais apagadas');
    } else if (code === DisconnectReason.restartRequired) {
      console.log('[torre] restart requerido', sessaoId, '— reconectando');
      setTimeout(() => iniciarSocket(sessaoId).catch(() => {}), 500);
    } else {
      await setSessao(sessaoId, {
        estado: 'caiu',
        qr: null,
        motivo: 'Conexão perdida. Verifique a rede e se o PC não suspendeu.',
      });
      await pausaFixas(sessaoId, 'Circuit breaker: queda de sessão');
      console.log('[torre] caiu', sessaoId, '(code', code, ') — reconectando em 3s');
      setTimeout(() => iniciarSocket(sessaoId).catch(() => {}), 3000);
    }
  }
}

async function limparAuth(sessaoId: string) {
  await rm(authDir(sessaoId), { recursive: true, force: true }).catch(() => {});
  const r = rts.get(sessaoId);
  if (r) r.temCreds = false;
}

async function desconectar(sessaoId: string, apagarLinha: boolean) {
  const r = rts.get(sessaoId);
  try {
    await r?.sock?.logout();
  } catch {}
  try {
    r?.sock?.end(undefined);
  } catch {}
  if (r) {
    r.sock = null;
    r.conectado = false;
    r.temCreds = false;
    r.breaker = false;
  }
  await limparAuth(sessaoId);
  if (!apagarLinha) {
    await setSessao(sessaoId, { estado: 'sem_sessao', numero: null, qr: null, motivo: null });
  }
}

// ---------- opt-out (permanente, cross-campanha, cross-número) ----------
async function onMensagens({ messages }: { messages: proto.IWebMessageInfo[] }) {
  for (const m of messages) {
    try {
      if (!m.message || m.key.fromMe) continue;
      const jid = m.key.remoteJid;
      if (!jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast')) continue;
      const texto = extraiTexto(m.message).trim().toLowerCase();
      if (!texto) continue;
      const cfg = await prisma.config.findUnique({ where: { id: 1 } });
      const palavras = (cfg?.palavrasOptout ?? 'sair,parar,descadastrar')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      if (palavras.some((p) => texto === p || texto.split(/\s+/).includes(p))) {
        await optOut(jid.split('@')[0].split(':')[0]);
      }
    } catch (e) {
      console.error('[torre] erro tratando mensagem', e);
    }
  }
}

async function optOut(numero: string) {
  let contato = await prisma.contato.findFirst({ where: { telefone: numero } });
  if (!contato && numero.length >= 8) {
    const fim = numero.slice(-8);
    contato = await prisma.contato.findFirst({ where: { telefone: { endsWith: fim } } });
  }
  if (!contato || contato.status === 'optout') return;
  await prisma.contato.update({
    where: { id: contato.id },
    data: { status: 'optout', optoutEm: new Date() },
  });
  await prisma.envio.updateMany({
    where: { contatoId: contato.id, status: { in: ['fila', 'enviando'] } },
    data: { status: 'optout' },
  });
  console.log('[torre] opt-out:', contato.nome, numero);
}

// ---------- circuit breaker (por número) ----------
// Pausa só as campanhas FIXAS neste chip. Campanhas em rodízio seguem nos outros.
async function pausaFixas(sessaoId: string, motivo: string) {
  const res = await prisma.campanha.updateMany({
    where: { status: 'rodando', numeroId: sessaoId },
    data: { status: 'pausada', motivoPausa: motivo },
  });
  if (res.count > 0) console.log('[torre] pausou', res.count, 'campanha(s) fixa(s) em', sessaoId);
}

async function acionarBreaker(sessaoId: string, motivo: string) {
  const r = rt(sessaoId);
  r.breaker = true;
  r.falhasSeguidas = 0;
  await setSessao(sessaoId, { estado: 'breaker', motivo: `Circuit breaker: ${motivo}` });
  await pausaFixas(sessaoId, `Circuit breaker (${motivo})`);
  console.log('[torre] breaker', sessaoId, ':', motivo);
}

// ---------- janela horária (global) ----------
function dentroDaJanela(ini: string, fim: string): boolean {
  const agora = new Date();
  const min = agora.getHours() * 60 + agora.getMinutes();
  const [hi, mi] = ini.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);
  return min >= hi * 60 + mi && min < hf * 60 + mf;
}

async function enviadosHoje(sessaoId: string): Promise<number> {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  return prisma.envio.count({
    where: { sessaoId, enviadoEm: { gte: inicio }, status: { in: ['entregue', 'falhou'] } },
  });
}

// Conclui campanhas sem nenhum envio pendente (fila/enviando) em nenhum chip.
async function concluiCampanhas() {
  const rodando = await prisma.campanha.findMany({ where: { status: 'rodando' } });
  for (const c of rodando) {
    const restante = await prisma.envio.count({
      where: { campanhaId: c.id, status: { in: ['fila', 'enviando'] } },
    });
    if (restante === 0) {
      await prisma.campanha.update({
        where: { id: c.id },
        data: { status: 'concluida', concluidaEm: new Date() },
      });
      console.log('[torre] campanha concluída:', c.nome);
    }
  }
}

// ---------- loop de envio ----------
// Tipo do chip com todos os freios (o que despacha precisa saber).
type SessaoFreios = {
  id: string;
  rotulo: string;
  numero: string | null;
  rampa: string;
  rampaDegrau: number;
  intMin: number;
  intMax: number;
  breakerLimite: number;
  loteMin: number;
  loteMax: number;
  pausaMin: number;
  pausaMax: number;
};

function aleatorioInt(a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// Teto do dia deste número (rampa[degrau]).
function tetoDe(s: { rampa: string; rampaDegrau: number }): number {
  const rampa = s.rampa.split(',').map(Number);
  return rampa[Math.min(s.rampaDegrau, rampa.length - 1)] ?? 0;
}

async function loopEnvio() {
  const cfg = await prisma.config.findUnique({ where: { id: 1 } });
  if (!cfg) return;
  await concluiCampanhas();
  if (!dentroDaJanela(cfg.janelaIni, cfg.janelaFim)) return;

  const sessoes = await prisma.sessao.findMany();

  // 1) Campanhas FIXAS: cada chip serve as SUAS, no seu próprio relógio, em
  //    paralelo. Envios já carimbados com sessaoId = numeroId no enfileiramento.
  for (const s of sessoes) {
    const r = rts.get(s.id);
    if (!r || !r.conectado || !r.sock || r.breaker || r.ocupado) continue;
    if (Date.now() < r.proximoEnvioEm || Date.now() < r.descansoAte) continue;
    if ((await enviadosHoje(s.id)) >= tetoDe(s)) continue;
    const envio = await proximoEnvioFixo(s.id);
    if (envio) void despacha(s, envio);
  }

  // 2) Campanhas em RODÍZIO: um só cadenciador gira entre os chips. Um manda, o
  //    próximo manda — alternado, um por vez.
  await loopRodizio(sessoes);
}

// Cadenciador do rodízio: escolhe UM envio pendente sem dono e o próximo chip na
// rotação (round-robin justo). A cadência entre disparos é única e compartilhada
// — trava aqui, não no relógio individual de cada chip. Assim os chips alternam
// (A, B, A, B…) em vez de um esvaziar o teto antes do outro começar.
async function loopRodizio(sessoes: SessaoFreios[]) {
  if (Date.now() < rodizioProximoEm) return;

  const envio = await proximoEnvioRodizio();
  if (!envio) return;

  // Chips elegíveis AGORA: conectados, sem breaker, fora de descanso e sob o
  // teto do dia. O intervalo curto individual (proximoEnvioEm) NÃO exclui do
  // rodízio — a cadência do rodízio já espaça os disparos.
  const elegiveis: SessaoFreios[] = [];
  for (const s of sessoes) {
    const r = rts.get(s.id);
    if (!r || !r.conectado || !r.sock || r.breaker || r.ocupado) continue;
    if (Date.now() < r.descansoAte) continue;
    if ((await enviadosHoje(s.id)) >= tetoDe(s)) continue;
    elegiveis.push(s);
  }
  if (elegiveis.length === 0) return;

  // Gira: próximo chip na rotação (round-robin). Com 1 elegível, ele leva tudo;
  // com 2+, alternam de verdade.
  const sessao = elegiveis[rodizioGiro % elegiveis.length];
  rodizioGiro = (rodizioGiro + 1) % 1_000_000;

  // Trava a cadência JÁ (antes de tocar a rede): o próximo disparo de rodízio só
  // sai após o intervalo deste chip. Impede rajada e mantém o turno justo mesmo
  // que o envio leve segundos.
  const espera = (sessao.intMin + Math.random() * (sessao.intMax - sessao.intMin)) * 1000;
  rodizioProximoEm = Date.now() + espera;

  void despacha(sessao, envio);
}

// Próximo envio de uma campanha FIXA neste chip (sessaoId já = este chip).
async function proximoEnvioFixo(sessaoId: string) {
  const camps = await prisma.campanha.findMany({
    where: { status: 'rodando', numeroId: sessaoId },
    orderBy: { criadaEm: 'asc' },
  });
  for (const camp of camps) {
    const envio = await prisma.envio.findFirst({
      where: { campanhaId: camp.id, status: 'fila', sessaoId },
      orderBy: { ordem: 'asc' },
    });
    if (envio) return envio;
  }
  return null;
}

// Próximo envio de QUALQUER campanha em rodízio (ainda sem dono: sessaoId null).
async function proximoEnvioRodizio() {
  const camps = await prisma.campanha.findMany({
    where: { status: 'rodando', numeroId: null },
    orderBy: { criadaEm: 'asc' },
  });
  for (const camp of camps) {
    const envio = await prisma.envio.findFirst({
      where: { campanhaId: camp.id, status: 'fila', sessaoId: null },
      orderBy: { ordem: 'asc' },
    });
    if (envio) return envio;
  }
  return null;
}

// Despacha UM envio por UM chip: claim atômico, envio e aplicação dos freios
// deste número (falha/breaker, descanso em lote, intervalo curto). Serve tanto
// o loop fixo quanto o cadenciador de rodízio.
async function despacha(
  sessao: SessaoFreios,
  envio: { id: string; contatoId: string; texto: string },
) {
  const r = rt(sessao.id);
  r.ocupado = true;
  try {
    // Claim atômico: só o chip que virar 'fila'->'enviando' segue. Impede
    // double-send se dois caminhos mirarem o mesmo envio no mesmo tick.
    const claim = await prisma.envio.updateMany({
      where: { id: envio.id, status: 'fila' },
      data: {
        status: 'enviando',
        sessaoId: sessao.id,
        // Snapshot durável de quem enviou — sobrevive à remoção do chip.
        remetente: sessao.numero ?? sessao.rotulo,
      },
    });
    if (claim.count === 0) return;

    const contato = await prisma.contato.findUnique({ where: { id: envio.contatoId } });
    if (!contato || contato.status === 'optout') {
      await prisma.envio.update({ where: { id: envio.id }, data: { status: 'optout' } });
      return;
    }

    const texto = resolveSaudacao(envio.texto);

    // Um disparo é uma tentativa que tocou a rede (entregue ou falha no envio).
    // Consulta de número inexistente não conta pro descanso em lote.
    let disparou = false;

    try {
      const res = (await r.sock!.onWhatsApp(contato.telefone))?.[0];
      if (!res?.exists) {
        await prisma.envio.update({
          where: { id: envio.id },
          data: {
            status: 'falhou',
            erro: 'Número não tem WhatsApp',
            tentativas: { increment: 1 },
            enviadoEm: new Date(),
          },
        });
        await registraFalha(sessao, r);
      } else {
        await r.sock!.sendMessage(res.jid, { text: texto });
        await prisma.envio.update({
          where: { id: envio.id },
          data: { status: 'entregue', enviadoEm: new Date() },
        });
        r.falhasSeguidas = 0;
        disparou = true;
        console.log('[torre]', sessao.id, 'enviado ->', contato.nome);
      }
    } catch (e) {
      await prisma.envio.update({
        where: { id: envio.id },
        data: {
          status: 'falhou',
          erro: String(e).slice(0, 300),
          tentativas: { increment: 1 },
          enviadoEm: new Date(),
        },
      });
      await registraFalha(sessao, r);
      disparou = true;
    }

    // Descanso em lote: rajada curta + descanso longo imita humano. A cada lote
    // (aleatório loteMin–loteMax) o chip pausa por pausaMin–pausaMax minutos.
    // Vai pra descansoAte (não proximoEnvioEm), que exclui o chip de FIXO e de
    // RODÍZIO ao mesmo tempo.
    if (disparou) {
      r.enviadosNoLote += 1;
      if (r.loteAlvo == null) r.loteAlvo = aleatorioInt(sessao.loteMin, sessao.loteMax);
      if (r.enviadosNoLote >= r.loteAlvo) {
        const min = Math.max(1, Math.min(sessao.pausaMin, sessao.pausaMax));
        const max = Math.max(min, sessao.pausaMax, sessao.pausaMin);
        const pausaMs = aleatorioInt(min, max) * 60_000;
        r.descansoAte = Date.now() + pausaMs;
        console.log(
          `[torre] ${sessao.id} descanso em lote: ${r.enviadosNoLote} disparos -> pausa ${Math.round(
            pausaMs / 60_000,
          )}min`,
        );
        r.enviadosNoLote = 0;
        r.loteAlvo = aleatorioInt(sessao.loteMin, sessao.loteMax);
        return;
      }
    }

    // Intervalo curto normal, deste número — fixo é assinatura de bot. Governa o
    // ritmo do loop FIXO deste chip (o rodízio tem cadência própria).
    const espera = (sessao.intMin + Math.random() * (sessao.intMax - sessao.intMin)) * 1000;
    r.proximoEnvioEm = Date.now() + espera;
  } catch (e) {
    console.error('[torre] despacha erro', sessao.id, e);
  } finally {
    r.ocupado = false;
  }
}

async function registraFalha(
  sessao: { id: string; breakerLimite: number },
  r: RT,
) {
  r.falhasSeguidas += 1;
  if (r.falhasSeguidas >= sessao.breakerLimite) {
    await acionarBreaker(sessao.id, `${r.falhasSeguidas} falhas seguidas`);
  }
}

// ---------- comandos do painel ----------
async function loopComando() {
  const sessoes = await prisma.sessao.findMany();
  for (const s of sessoes) {
    if (!s.comando) continue;
    if (s.comando === 'remover') {
      await desconectar(s.id, true);
      await prisma.sessao.delete({ where: { id: s.id } }).catch(() => {});
      rts.delete(s.id);
      console.log('[torre] chip removido', s.id);
      continue;
    }
    await prisma.sessao.update({ where: { id: s.id }, data: { comando: null } }).catch(() => {});
    if (s.comando === 'conectar') {
      if (!rts.get(s.id)?.conectado) await iniciarSocket(s.id).catch((e) => console.error(e));
    } else if (s.comando === 'desconectar') {
      await desconectar(s.id, false);
      console.log('[torre] desconectado por comando', s.id);
    }
  }

  // Sockets órfãos (sessão sumiu do banco por fora): derruba.
  for (const id of [...rts.keys()]) {
    if (!sessoes.find((s) => s.id === id)) {
      const r = rts.get(id);
      try {
        r?.sock?.end(undefined);
      } catch {}
      rts.delete(id);
    }
  }
}

// ---------- heartbeat (do processo) ----------
async function heartbeat() {
  await prisma.worker.update({ where: { id: 1 }, data: { heartbeat: new Date() } }).catch(() => {});
}

// ---------- boot ----------
async function main() {
  await garanteSingletons();

  // Envios presos em 'enviando' (worker caiu no meio) voltam pra fila.
  await prisma.envio.updateMany({ where: { status: 'enviando' }, data: { status: 'fila' } });
  // Rodízio: solta o dono dos envios ainda na fila, pra qualquer chip retomar.
  const rodizio = await prisma.campanha.findMany({ where: { numeroId: null }, select: { id: true } });
  if (rodizio.length) {
    await prisma.envio.updateMany({
      where: { campanhaId: { in: rodizio.map((c) => c.id) }, status: 'fila' },
      data: { sessaoId: null },
    });
  }

  console.log('[torre] worker subindo…');

  // Reconecta só chips que já têm credenciais em disco (pareados) — sem QR novo.
  // Os demais ficam idle até o operador clicar "conectar".
  const sessoes = await prisma.sessao.findMany();
  for (const s of sessoes) {
    if (existsSync(`${authDir(s.id)}/creds.json`)) {
      await iniciarSocket(s.id).catch((e) => console.error('[torre] falha reconectar', s.id, e));
    } else {
      await setSessao(s.id, { estado: 'sem_sessao', qr: null });
    }
  }

  setInterval(heartbeat, 5_000);
  setInterval(loopComando, 2_000);
  setInterval(loopEnvio, 2_000);
  await heartbeat();
}

process.on('unhandledRejection', (e) => console.error('[torre] unhandledRejection', e));
process.on('SIGINT', async () => {
  console.log('\n[torre] encerrando…');
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
});

main().catch((e) => {
  console.error('[torre] falha fatal no boot', e);
  process.exit(1);
});
