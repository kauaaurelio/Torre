import { NextResponse } from 'next/server';
import { prisma, garanteSingletons } from '@/lib/prisma';
import { campanhaRelevante, resumoCampanha, workerOnline } from '@/lib/consultas';
import type { EstadoApi, EstadoSessao, EstadoConexaoRaw, SessaoResumo } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

// LED da barra só entende conectado/conectando/caiu/desconhecido.
function paraLed(raw: EstadoConexaoRaw): EstadoSessao {
  switch (raw) {
    case 'conectado':
      return 'conectado';
    case 'gerando_qr':
    case 'aguardando_leitura':
    case 'conectando':
      return 'conectando';
    case 'caiu':
    case 'breaker':
      return 'caiu';
    default:
      return 'desconhecido';
  }
}

// Agregado da barra: conectado > conectando > caiu > desconhecido.
function agrega(estados: EstadoSessao[]): EstadoSessao {
  if (estados.includes('conectado')) return 'conectado';
  if (estados.includes('conectando')) return 'conectando';
  if (estados.includes('caiu')) return 'caiu';
  return 'desconhecido';
}

export async function GET() {
  await garanteSingletons();
  const worker = await prisma.worker.findUniqueOrThrow({ where: { id: 1 } });
  const online = workerOnline(worker.heartbeat);

  const linhas = await prisma.sessao.findMany({ orderBy: { criadaEm: 'asc' } });
  const sessoes: SessaoResumo[] = linhas.map((s) => {
    const raw = (online ? s.estado : 'sem_sessao') as EstadoConexaoRaw;
    return {
      id: s.id,
      rotulo: s.rotulo,
      estadoRaw: raw,
      numero: s.estado === 'conectado' ? s.numero : null,
      qr: s.estado === 'aguardando_leitura' ? s.qr : null,
      motivo: s.motivo,
    };
  });

  const leds = sessoes.map((s) => paraLed(s.estadoRaw));
  const conectados = sessoes.filter((s) => s.estadoRaw === 'conectado').length;
  const numeroUnico = conectados === 1 ? sessoes.find((s) => s.estadoRaw === 'conectado')?.numero ?? null : null;

  const camp = await campanhaRelevante();
  const resumo = camp ? await resumoCampanha(camp.id) : null;

  const corpo: EstadoApi = {
    sessao: {
      estado: online ? agrega(leds) : 'desconhecido',
      numero: online ? numeroUnico : null,
    },
    workerOnline: online,
    conectados: online ? conectados : 0,
    sessoes,
    campanha: {
      nome: resumo?.nome ?? null,
      total: resumo?.total ?? 0,
      modulos: resumo?.modulos ?? [],
    },
  };
  return NextResponse.json(corpo);
}
