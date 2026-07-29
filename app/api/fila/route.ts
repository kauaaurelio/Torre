import { NextResponse } from 'next/server';
import { prisma, garanteSingletons } from '@/lib/prisma';
import { campanhaRelevante, resumoCampanha } from '@/lib/consultas';
import { normalizaTelefone } from '@/lib/telefone';

export const dynamic = 'force-dynamic';

// Estado da fila para a tela Fila: a campanha relevante + os freios em vigor.
export async function GET() {
  await garanteSingletons();
  const camp = await campanhaRelevante();
  if (!camp) return NextResponse.json({ campanha: null });

  const resumo = await resumoCampanha(camp.id);
  const cfg = await prisma.config.findUniqueOrThrow({ where: { id: 1 } });

  // Os freios são POR NÚMERO (o Config global só guarda os defaults copiados a
  // cada chip novo — NÃO é o que vale no envio). A campanha roda num chip fixo
  // (numeroId) ou em rodízio (numeroId null → todos os chips). O display tem que
  // refletir o(s) chip(s) que de fato servem a campanha, não o Config.
  const chips = await prisma.sessao.findMany();
  const servindo = camp.numeroId ? chips.filter((s) => s.id === camp.numeroId) : chips;
  const base = servindo.length ? servindo : chips;

  // Número(s) que de fato podem disparar esta campanha AGORA (conectados). Sem
  // nenhum, os freios abaixo são só o template do Config — nada sai. O display
  // precisa dizer isso em vez de mostrar número fantasma.
  const conectadosServindo = servindo.filter((s) => s.estado === 'conectado');

  const tetoDoChip = (s: { rampa: string; rampaDegrau: number }) => {
    const r = s.rampa.split(',').map(Number);
    return r[Math.min(s.rampaDegrau, r.length - 1)] ?? 0;
  };

  // Intervalo: chip fixo → o dele; rodízio → o span entre os chips (menor mín,
  // maior máx), já que cada chip aplica o seu.
  const intMin = base.length ? Math.min(...base.map((s) => s.intMin)) : cfg.intMin;
  const intMax = base.length ? Math.max(...base.map((s) => s.intMax)) : cfg.intMax;
  // Teto do dia: chip fixo → o teto dele; rodízio → soma (capacidade agregada).
  const tetoHoje = base.reduce((acc, s) => acc + tetoDoChip(s), 0);
  // Ladder da rampa pra exibir (idêntico entre chips por padrão).
  const rampa = (base[0]?.rampa ?? cfg.rampa).split(',').map(Number);

  // Enviados hoje pelos chips que servem esta campanha (alinha com o tetoHoje).
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const enviadosHoje = await prisma.envio.count({
    where: {
      enviadoEm: { gte: inicioDia },
      status: { in: ['entregue', 'falhou'] },
      ...(camp.numeroId ? { sessaoId: camp.numeroId } : {}),
    },
  });

  // Detalhe da fila: cada contato desta campanha, com quem enviou (o chip) e
  // pra qual número/lugar. `remetente` é o snapshot durável gravado no disparo;
  // se ainda em fila (ou registro antigo sem snapshot), cai no chip da relação.
  const registrosRaw = await prisma.envio.findMany({
    where: { campanhaId: camp.id },
    orderBy: { ordem: 'asc' },
    take: 500,
    select: {
      id: true,
      status: true,
      enviadoEm: true,
      remetente: true,
      erro: true,
      sessao: { select: { numero: true, rotulo: true } },
      contato: { select: { nome: true, telefone: true, cidade: true } },
    },
  });
  const registros = registrosRaw.map((e) => ({
    id: e.id,
    status: e.status,
    enviadoEm: e.enviadoEm,
    erro: e.erro,
    // Quem enviou: snapshot > chip da relação > null (ainda não enviado).
    remetente: e.remetente ?? e.sessao?.numero ?? e.sessao?.rotulo ?? null,
    contato: e.contato.nome,
    telefone: normalizaTelefone(e.contato.telefone).exibicao,
    cidade: e.contato.cidade,
  }));

  return NextResponse.json({
    campanha: {
      id: resumo.id,
      nome: resumo.nome,
      status: resumo.status,
      total: resumo.total,
      motivoPausa: resumo.motivoPausa,
      modulos: resumo.modulos,
      contagem: resumo.contagem,
    },
    freios: {
      intMin,
      intMax,
      rampa,
      tetoHoje,
      enviadosHoje,
      // 0 = nenhum chip conectado servindo → o display não deve fingir freio real.
      numerosConectados: conectadosServindo.length,
      rodizio: camp.numeroId === null,
    },
    registros,
  });
}

// Remove números individuais da fila: recebe { ids: string[] } (ids de Envio).
// Corrige o `total` da(s) campanha(s) afetada(s) — senão o progresso
// (concluídos/total) fica torto. Hard delete (mesma linha da exclusão de
// contato). Um envio em 'enviando' na microjanela do disparo cai no try/catch do
// worker, sem crash. Validação de entrada continua valendo (ver CLAUDE.md).
export async function DELETE(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 });
  }

  const ids = (body as { ids?: unknown })?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === 'string' && x)) {
    return NextResponse.json(
      { erro: 'Informe "ids": lista não vazia de identificadores.' },
      { status: 400 },
    );
  }
  const lista = ids as string[];

  // A quais campanhas os envios pertencem — pra decrementar o total certo de cada.
  const envios = await prisma.envio.findMany({
    where: { id: { in: lista } },
    select: { campanhaId: true },
  });
  if (envios.length === 0) return NextResponse.json({ ok: true, apagados: 0 });

  const porCampanha = new Map<string, number>();
  for (const e of envios) porCampanha.set(e.campanhaId, (porCampanha.get(e.campanhaId) ?? 0) + 1);

  await prisma.$transaction([
    prisma.envio.deleteMany({ where: { id: { in: lista } } }),
    ...Array.from(porCampanha, ([campanhaId, n]) =>
      prisma.campanha.update({ where: { id: campanhaId }, data: { total: { decrement: n } } }),
    ),
  ]);

  return NextResponse.json({ ok: true, apagados: envios.length });
}
