import { NextResponse } from 'next/server';
import { prisma, garanteSingletons } from '@/lib/prisma';
import { campanhaRelevante, resumoCampanha } from '@/lib/consultas';

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
    },
  });
}
