import { NextResponse } from 'next/server';
import { prisma, garanteSingletons } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Config global: janela + opt-out valem pra todos os chips; intMin/intMax/rampa/
// breakerLimite são os DEFAULTS copiados ao criar um chip novo. Os freios em
// vigor de cada número ficam na própria Sessao (ver /api/sessao PUT).
export async function GET() {
  await garanteSingletons();
  const c = await prisma.config.findUniqueOrThrow({ where: { id: 1 } });
  const chips = await prisma.sessao.findMany({ orderBy: { criadaEm: 'asc' } });
  return NextResponse.json({
    janelaIni: c.janelaIni,
    janelaFim: c.janelaFim,
    palavrasOptout: c.palavrasOptout.split(',').filter(Boolean),
    // defaults globais (usados pra novos chips e como base do editor):
    intMin: c.intMin,
    intMax: c.intMax,
    rampa: c.rampa.split(',').map(Number),
    breakerLimite: c.breakerLimite,
    // freios em vigor por chip:
    chips: chips.map((s) => ({
      id: s.id,
      rotulo: s.rotulo,
      intMin: s.intMin,
      intMax: s.intMax,
      rampa: s.rampa.split(',').map(Number),
      rampaDegrau: s.rampaDegrau,
      breakerLimite: s.breakerLimite,
      loteMin: s.loteMin,
      loteMax: s.loteMax,
      pausaMin: s.pausaMin,
      pausaMax: s.pausaMax,
    })),
  });
}

export async function PUT(req: Request) {
  await garanteSingletons();
  const body = await req.json();

  const intMin = Number(body.intMin);
  const intMax = Number(body.intMax);
  if (Number.isFinite(intMin) && Number.isFinite(intMax) && intMin >= intMax) {
    return NextResponse.json(
      { erro: 'O intervalo mínimo precisa ser menor que o máximo.' },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {};
  if (typeof body.janelaIni === 'string') data.janelaIni = body.janelaIni;
  if (typeof body.janelaFim === 'string') data.janelaFim = body.janelaFim;
  if (Number.isFinite(intMin)) data.intMin = Math.max(1, intMin);
  if (Number.isFinite(intMax)) data.intMax = Math.max(1, intMax);
  if (Number.isFinite(Number(body.breakerLimite)))
    data.breakerLimite = Math.max(1, Number(body.breakerLimite));
  if (Array.isArray(body.rampa)) data.rampa = body.rampa.map(Number).join(',');
  if (Array.isArray(body.palavrasOptout))
    data.palavrasOptout = body.palavrasOptout.map((s: string) => s.trim().toLowerCase()).join(',');

  await prisma.config.update({ where: { id: 1 }, data });
  return NextResponse.json({ ok: true });
}
