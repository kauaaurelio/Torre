import { NextResponse } from 'next/server';
import { prisma, garanteSingletons } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Canal painel -> worker, por chip. 'conectar' pede pareamento (QR) daquele
// número; 'desconectar' pede logout. O worker consome o comando e o zera.
export async function POST(req: Request) {
  await garanteSingletons();
  const { sessaoId, acao } = await req.json();
  if (typeof sessaoId !== 'string' || !sessaoId) {
    return NextResponse.json({ erro: 'Sessão inválida.' }, { status: 400 });
  }
  if (acao !== 'conectar' && acao !== 'desconectar') {
    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 });
  }
  const existe = await prisma.sessao.findUnique({ where: { id: sessaoId } });
  if (!existe) {
    return NextResponse.json({ erro: 'Sessão não encontrada.' }, { status: 404 });
  }
  await prisma.sessao.update({
    where: { id: sessaoId },
    data: {
      comando: acao,
      ...(acao === 'conectar' ? { estado: 'gerando_qr', motivo: null } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
