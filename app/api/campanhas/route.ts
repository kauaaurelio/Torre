import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contaCombinacoes, renderiza } from '@/lib/variacao';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json();
  const nome = (body.nome as string)?.trim();
  const template = (body.template as string) ?? '';
  const segmento = (body.segmento as string)?.trim() || null;
  // null = rodízio entre os chips conectados; setado = chip fixo.
  const numeroId = (body.numeroId as string)?.trim() || null;

  if (!nome) return NextResponse.json({ erro: 'Dê um nome à campanha.' }, { status: 400 });
  if (template.trim().length === 0)
    return NextResponse.json({ erro: 'A mensagem está vazia.' }, { status: 400 });
  if (contaCombinacoes(template) < 2)
    return NextResponse.json(
      { erro: 'Sem variação {a|b}, todos recebem texto idêntico — o padrão mais denunciável.' },
      { status: 400 },
    );

  // Só celular ativo entra na fila. Fixo/inválido não têm WhatsApp; opt-out é
  // permanente e cross-campanha.
  const contatos = await prisma.contato.findMany({
    where: {
      status: 'ativo',
      tipo: 'mobile',
      ...(segmento ? { segmentos: { contains: segmento } } : {}),
    },
    orderBy: { criadoEm: 'asc' },
  });

  // `contains` casa substring; refina pra segmento exato dentro do CSV.
  const alvo = segmento
    ? contatos.filter((c) => c.segmentos.split(',').includes(segmento))
    : contatos;

  if (alvo.length === 0)
    return NextResponse.json(
      { erro: 'Nenhum destinatário elegível (celular ativo) para esse segmento.' },
      { status: 400 },
    );

  // Número fixo: valida que existe. Rodízio: null.
  if (numeroId) {
    const chip = await prisma.sessao.findUnique({ where: { id: numeroId } });
    if (!chip)
      return NextResponse.json({ erro: 'Número escolhido não existe mais.' }, { status: 400 });
  }

  const campanha = await prisma.campanha.create({
    data: { nome, segmento, template, status: 'rodando', total: alvo.length, numeroId },
  });

  // Materializa a variação por contato — cada um recebe uma combinação diferente.
  // Fixo: já carimba o sessaoId. Rodízio: null (o worker escolhe no envio).
  const dados = alvo.map((c, i) => ({
    campanhaId: campanha.id,
    contatoId: c.id,
    sessaoId: numeroId,
    ordem: i,
    // Sem `agora`: {{saudacao}} fica intacto e o worker o resolve na hora do envio.
    texto: renderiza(template, i, {
      nome: c.nome,
      segmento: c.segmentos.split(',')[0] || null,
      cidade: c.cidade,
      nicho: c.nicho,
      empresa: c.empresa,
    }),
  }));

  // createMany não aceita relações; os campos escalares bastam.
  await prisma.envio.createMany({ data: dados });

  return NextResponse.json({ ok: true, id: campanha.id, total: alvo.length });
}
