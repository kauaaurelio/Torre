import { prisma } from './prisma';
import type { EstadoModulo } from './tipos';

const MAP: Record<string, EstadoModulo> = {
  fila: 'fila',
  enviando: 'enviando',
  entregue: 'entregue',
  falhou: 'falhou',
  optout: 'optout',
};

// Worker é considerado online se bateu o heartbeat nos últimos 20s.
export function workerOnline(heartbeat: Date | null | undefined): boolean {
  if (!heartbeat) return false;
  return Date.now() - new Date(heartbeat).getTime() < 20_000;
}

// A campanha que a tela deve mostrar: rodando > pausada > mais recente.
export async function campanhaRelevante() {
  return (
    (await prisma.campanha.findFirst({
      where: { status: 'rodando' },
      orderBy: { criadaEm: 'desc' },
    })) ??
    (await prisma.campanha.findFirst({
      where: { status: 'pausada' },
      orderBy: { criadaEm: 'desc' },
    })) ??
    (await prisma.campanha.findFirst({ orderBy: { criadaEm: 'desc' } }))
  );
}

export interface ResumoCampanha {
  id: string;
  nome: string;
  status: string;
  total: number;
  motivoPausa: string | null;
  modulos: EstadoModulo[];
  contagem: Record<EstadoModulo, number>;
}

export async function resumoCampanha(campanhaId: string): Promise<ResumoCampanha> {
  const camp = await prisma.campanha.findUniqueOrThrow({ where: { id: campanhaId } });
  const envios = await prisma.envio.findMany({
    where: { campanhaId },
    orderBy: { ordem: 'asc' },
    select: { status: true },
  });
  const contagem: Record<EstadoModulo, number> = {
    fila: 0,
    enviando: 0,
    entregue: 0,
    falhou: 0,
    optout: 0,
  };
  const modulos: EstadoModulo[] = envios.map((e) => {
    const m = MAP[e.status] ?? 'fila';
    contagem[m] += 1;
    return m;
  });
  return {
    id: camp.id,
    nome: camp.nome,
    status: camp.status,
    total: camp.total,
    motivoPausa: camp.motivoPausa,
    modulos,
    contagem,
  };
}
