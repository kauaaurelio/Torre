import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Exclui a campanha inteira — a "fila inteira". Envio tem onDelete: Cascade em
// campanhaId, então todos os disparos ligados somem junto: a campanha desaparece
// da Fila e do Relatório. Hard delete, sem desfazer (mesma semântica da exclusão
// de contato — LGPD art. 18 VI). Se o worker estiver disparando um envio desta
// campanha na exata microjanela da exclusão, o `envio.update` mid-send cai no
// try/catch do `despacha` (worker/index.ts) — loga e segue, sem crash nem
// double-send. Sem exposição de rede (127.0.0.1), mas a validação continua valendo.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const camp = await prisma.campanha.findUnique({ where: { id } });
  if (!camp) return NextResponse.json({ erro: 'Campanha não encontrada.' }, { status: 404 });

  await prisma.campanha.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
