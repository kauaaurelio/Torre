// Normalização de telefone BR. WhatsApp só existe em celular: a maior parte de
// uma lista raspada é linha fixa (3xxx-xxxx) que nunca vai entregar. Aqui a
// gente separa o que dá pra disparar do que não dá, antes de gastar envio.

export type TipoTelefone = 'mobile' | 'fixo' | 'invalido';

export interface TelefoneNormalizado {
  raw: string;
  normalizado: string; // 55 + DDD + número (dígitos), ou os dígitos crus se inválido
  tipo: TipoTelefone;
  exibicao: string; // +55 (51) 99364-9980
}

// Extrai só os dígitos e tira o "55" de país se já vier com ele.
function semPais(digitos: string): string {
  if (digitos.length >= 12 && digitos.startsWith('55')) return digitos.slice(2);
  return digitos;
}

// DDDs válidos no Brasil: 11–99, com buracos. Checagem frouxa (>= 11) já filtra
// o grosso do lixo ("Sem info", números sem DDD).
function dddValido(ddd: string): boolean {
  const n = Number(ddd);
  return n >= 11 && n <= 99;
}

export function normalizaTelefone(bruto: string): TelefoneNormalizado {
  const raw = (bruto ?? '').trim();
  const digitos = raw.replace(/\D/g, '');
  const local = semPais(digitos);

  // Sem DDD + número plausível -> não dá pra discar com segurança.
  if (local.length < 10 || local.length > 11 || !dddValido(local.slice(0, 2))) {
    return { raw, normalizado: digitos, tipo: 'invalido', exibicao: raw || '—' };
  }

  const ddd = local.slice(0, 2);
  const numero = local.slice(2);

  // 11 dígitos (DDD + 9 dígitos começando em 9) = celular.
  // 10 dígitos (DDD + 8 dígitos começando em 2–5) = fixo.
  let tipo: TipoTelefone;
  if (numero.length === 9 && numero.startsWith('9')) tipo = 'mobile';
  else if (numero.length === 8 && /^[2-5]/.test(numero)) tipo = 'fixo';
  else tipo = 'invalido';

  const normalizado = tipo === 'invalido' ? digitos : `55${ddd}${numero}`;

  return { raw, normalizado, tipo, exibicao: formata(ddd, numero, tipo) };
}

function formata(ddd: string, numero: string, tipo: TipoTelefone): string {
  if (tipo === 'invalido') return `${ddd}${numero}` || '—';
  const meio = numero.length === 9 ? numero.slice(0, 5) : numero.slice(0, 4);
  const fim = numero.length === 9 ? numero.slice(5) : numero.slice(4);
  return `+55 (${ddd}) ${meio}-${fim}`;
}

// JID base para o Baileys resolver via onWhatsApp (sem sufixo — o worker
// consulta a existência e usa o JID canônico que o WhatsApp devolver).
export function numeroParaConsulta(normalizado: string): string {
  return normalizado;
}
