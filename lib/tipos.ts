// Tipos compartilhados entre painel e worker. Antes viviam em lib/mock.ts
// (demo); agora são o contrato real. A fita e a barra de status leem daqui.

export type EstadoSessao = 'conectado' | 'conectando' | 'caiu' | 'desconhecido';
export type EstadoModulo = 'fila' | 'enviando' | 'entregue' | 'falhou' | 'optout';

export interface Sessao {
  estado: EstadoSessao;
  numero: string | null;
}

export interface Campanha {
  nome: string | null;
  total: number;
  modulos: EstadoModulo[];
}

export interface OptIn {
  data: string | null;
  origem: string | null;
  por: string | null;
}

export interface Contato {
  id: string;
  nome: string;
  telefone: string; // exibição
  tipo: 'mobile' | 'fixo' | 'invalido';
  segmentos: string[];
  cidade: string | null;
  nicho: string | null;
  empresa: string | null;
  optIn: OptIn;
  status: 'ativo' | 'optout';
}

// Estado bruto da conexão, mais granular que EstadoSessao (etapas do QR).
export type EstadoConexaoRaw =
  | 'sem_sessao'
  | 'gerando_qr'
  | 'aguardando_leitura'
  | 'conectando'
  | 'conectado'
  | 'caiu'
  | 'breaker';

// Um chip na lista de números. `qr` só vem preenchido no estado de leitura.
export interface SessaoResumo {
  id: string;
  rotulo: string;
  estadoRaw: EstadoConexaoRaw;
  numero: string | null;
  qr: string | null;
  motivo: string | null;
}

export interface EstadoApi {
  // Agregado pra barra de status / LED: pior estado manda a cor.
  sessao: Sessao;
  workerOnline: boolean;
  conectados: number; // quantos chips conectados agora
  sessoes: SessaoResumo[];
  campanha: Campanha;
}
