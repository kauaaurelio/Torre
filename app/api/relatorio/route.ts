import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { campanhaRelevante, resumoCampanha } from '@/lib/consultas';

export const dynamic = 'force-dynamic';

// Relatório da campanha relevante (ou de ?id=). A tela desenha a taxa de entrega.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  const camp = id
    ? await prisma.campanha.findUnique({ where: { id } })
    : await campanhaRelevante();

  if (!camp) return NextResponse.json({ campanha: null });

  const resumo = await resumoCampanha(camp.id);
  return NextResponse.json({
    campanha: {
      id: resumo.id,
      nome: resumo.nome,
      status: resumo.status,
      total: resumo.total,
      contagem: resumo.contagem,
    },
  });
}
