import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizaTelefone } from '@/lib/telefone';
import type { Contato } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

function paraContato(c: {
  id: string;
  nome: string;
  telefone: string;
  telefoneRaw: string;
  tipo: string;
  segmentos: string;
  cidade: string | null;
  nicho: string | null;
  empresa: string | null;
  optinData: string | null;
  optinOrigem: string | null;
  optinPor: string | null;
  status: string;
}): Contato {
  return {
    id: c.id,
    nome: c.nome,
    telefone: normalizaTelefone(c.telefoneRaw).exibicao,
    tipo: c.tipo as Contato['tipo'],
    segmentos: c.segmentos ? c.segmentos.split(',').filter(Boolean) : [],
    cidade: c.cidade,
    nicho: c.nicho,
    empresa: c.empresa,
    optIn: { data: c.optinData, origem: c.optinOrigem, por: c.optinPor },
    status: c.status as Contato['status'],
  };
}

export async function GET() {
  const contatos = await prisma.contato.findMany({ orderBy: { criadoEm: 'desc' } });
  const lista = contatos.map(paraContato);
  const segmentos = Array.from(
    new Set(lista.flatMap((c) => c.segmentos)),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return NextResponse.json({ contatos: lista, segmentos });
}

// Exclusão hard (single ou lote): recebe { ids: string[] }. Hard delete atende a
// LGPD art. 18 VI (eliminação real). Envio tem onDelete: Cascade em contato, então
// os disparos ligados ao contato somem junto — inclusive de campanhas já rodadas
// (o relatório perde essas linhas). Sem exposição de rede (127.0.0.1), mas a
// validação de entrada continua valendo (ver CLAUDE.md).
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

  const r = await prisma.contato.deleteMany({ where: { id: { in: ids as string[] } } });
  return NextResponse.json({ ok: true, apagados: r.count });
}
