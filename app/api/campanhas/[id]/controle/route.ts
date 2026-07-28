import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Pausa/retoma a campanha. O worker respeita `status`: só dispara 'rodando'.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { acao } = await req.json();

  const camp = await prisma.campanha.findUnique({ where: { id } });
  if (!camp) return NextResponse.json({ erro: 'Campanha não encontrada.' }, { status: 404 });

  if (acao === 'pausar') {
    await prisma.campanha.update({
      where: { id },
      data: { status: 'pausada', motivoPausa: 'Pausada pelo operador' },
    });
  } else if (acao === 'retomar') {
    // Zera o motivo de pausa e reabre a fila; envios 'enviando' órfãos voltam pra fila.
    await prisma.envio.updateMany({
      where: { campanhaId: id, status: 'enviando' },
      data: { status: 'fila' },
    });
    await prisma.campanha.update({
      where: { id },
      data: { status: 'rodando', motivoPausa: null },
    });
  } else {
    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
