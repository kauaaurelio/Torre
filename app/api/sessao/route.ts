import { rm } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { prisma, garanteSingletons } from '@/lib/prisma';
import { workerOnline } from '@/lib/consultas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Adiciona um número. Rótulo automático ("Chip N") se não vier um. Os freios do
// novo chip começam com os defaults globais do Config (o operador ajusta depois
// em Configurações).
export async function POST(req: Request) {
  await garanteSingletons();
  const body = await req.json().catch(() => ({}));
  const rotuloInformado = (body?.rotulo as string | undefined)?.trim();

  const cfg = await prisma.config.findUniqueOrThrow({ where: { id: 1 } });
  const n = await prisma.sessao.count();
  const rotulo = rotuloInformado || `Chip ${n + 1}`;

  const sessao = await prisma.sessao.create({
    data: {
      rotulo,
      intMin: cfg.intMin,
      intMax: cfg.intMax,
      rampa: cfg.rampa,
      breakerLimite: cfg.breakerLimite,
      loteMin: cfg.loteMin,
      loteMax: cfg.loteMax,
      pausaMin: cfg.pausaMin,
      pausaMax: cfg.pausaMax,
    },
  });
  return NextResponse.json({ ok: true, id: sessao.id, rotulo: sessao.rotulo });
}

// Edita rótulo e freios de um chip específico. Cada número tem sua reputação —
// os freios são por chip.
export async function PUT(req: Request) {
  await garanteSingletons();
  const body = await req.json().catch(() => ({}));
  const id = (body?.id as string | undefined)?.trim();
  if (!id) return NextResponse.json({ erro: 'Sessão inválida.' }, { status: 400 });

  const existe = await prisma.sessao.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: 'Sessão não encontrada.' }, { status: 404 });

  const intMin = Number(body.intMin);
  const intMax = Number(body.intMax);
  if (Number.isFinite(intMin) && Number.isFinite(intMax) && intMin >= intMax) {
    return NextResponse.json(
      { erro: 'O intervalo mínimo precisa ser menor que o máximo.' },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {};
  if (typeof body.rotulo === 'string' && body.rotulo.trim()) data.rotulo = body.rotulo.trim();
  if (Number.isFinite(intMin)) data.intMin = Math.max(1, intMin);
  if (Number.isFinite(intMax)) data.intMax = Math.max(1, intMax);
  if (Number.isFinite(Number(body.rampaDegrau)))
    data.rampaDegrau = Math.max(0, Number(body.rampaDegrau));
  if (Number.isFinite(Number(body.breakerLimite)))
    data.breakerLimite = Math.max(1, Number(body.breakerLimite));
  if (Array.isArray(body.rampa)) data.rampa = body.rampa.map(Number).join(',');
  if (Number.isFinite(Number(body.loteMin))) data.loteMin = Math.max(1, Number(body.loteMin));
  if (Number.isFinite(Number(body.loteMax))) data.loteMax = Math.max(1, Number(body.loteMax));
  if (Number.isFinite(Number(body.pausaMin))) data.pausaMin = Math.max(1, Number(body.pausaMin));
  if (Number.isFinite(Number(body.pausaMax))) data.pausaMax = Math.max(1, Number(body.pausaMax));

  await prisma.sessao.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// Remove um número. Pede logout ao worker (via comando 'remover') e apaga a
// linha. Envios/campanhas apontando pra ela viram null (rodízio) por SetNull.
export async function DELETE(req: Request) {
  await garanteSingletons();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ erro: 'Sessão inválida.' }, { status: 400 });

  const existe = await prisma.sessao.findUnique({ where: { id } });
  if (!existe) return NextResponse.json({ erro: 'Sessão não encontrada.' }, { status: 404 });

  const worker = await prisma.worker.findUnique({ where: { id: 1 } });
  if (workerOnline(worker?.heartbeat)) {
    // Worker vivo é dono da limpeza: derruba o socket, apaga o .baileys/<id> e
    // remove a própria linha. Só sinalizamos.
    await prisma.sessao.update({ where: { id }, data: { comando: 'remover' } });
    return NextResponse.json({ ok: true, via: 'worker' });
  }

  // Worker morto: não há socket vivo. Removemos a linha e a pasta de credenciais
  // aqui mesmo pra não deixar o chip preso.
  await rm(`.baileys/${id}`, { recursive: true, force: true }).catch(() => {});
  await prisma.sessao.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true, via: 'painel' });
}
