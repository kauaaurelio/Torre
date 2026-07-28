// Spintax + variáveis + condições. Variação é freio, não enfeite: texto idêntico
// pra todo mundo é a assinatura de bot mais denunciável. Cada contato recebe uma
// combinação diferente, derivada de um seed (o índice do contato na fila).
//
// Ordem de precedência (importa por causa da colisão {{a|b}} × {a|b}):
//   1. condicional de presença  {{#se campo}}…{{/se}} / {{#sem campo}}…{{/sem}}
//   2. variáveis com fallback    {{campo}} ou {{campo|texto padrão}}
//   3. spintax                   {a|b|c}
// Os passos 1–2 comem os `{{…}}` antes do spintax rodar, então o `|` de um
// fallback nunca é confundido com um grupo de variação.

// {a|b|c} -> um dos grupos. Não aninha. (spintax, chave simples)
export const RE_GRUPO = /\{([^{}]+\|[^{}]+)\}/g;

// {{#se campo}}…{{/se}} e {{#sem campo}}…{{/sem}}
const RE_SE = /\{\{#se\s+(\w+)\}\}([\s\S]*?)\{\{\/se\}\}/g;
const RE_SEM = /\{\{#sem\s+(\w+)\}\}([\s\S]*?)\{\{\/sem\}\}/g;

// {{campo}} ou {{campo|texto padrão}} — não casa os blocos #se/#sem (que têm `#`
// ou `/` logo após as chaves).
const RE_VAR = /\{\{\s*([a-z_]+)(?:\s*\|\s*([^}]*))?\s*\}\}/g;

export interface DadosContato {
  nome: string;
  segmento?: string | null;
  cidade?: string | null;
  nicho?: string | null;
  empresa?: string | null;
}

// Bom dia (<12) / Boa tarde (12–17) / Boa noite (>=18).
export function saudacaoDe(d: Date): string {
  const h = d.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Só conta os grupos de spintax {a|b}. Remove os {{…}} antes, senão um fallback
// {{empresa|sua empresa}} seria contado como variação falsa.
export function contaCombinacoes(msg: string): number {
  const semVars = msg
    .replace(RE_SE, '$2')
    .replace(RE_SEM, '')
    .replace(RE_VAR, '');
  let total = 1;
  for (const m of semVars.matchAll(RE_GRUPO)) {
    total *= m[1].split('|').length;
  }
  return total;
}

// Valor bruto de cada variável a partir do contato. `saudacao` é tratado à parte
// (depende da hora, não do contato) — ver `renderiza`.
function valorVar(campo: string, c: DadosContato): string {
  switch (campo) {
    case 'primeiro_nome':
      return c.nome.trim().split(/\s+/)[0] || c.nome;
    case 'nome':
      return c.nome;
    case 'segmento':
      return c.segmento || '';
    case 'cidade':
      return c.cidade || '';
    case 'nicho':
      return c.nicho || '';
    case 'empresa':
      return c.empresa || c.nome || '';
    default:
      return '';
  }
}

// Renderiza uma combinação determinística a partir do seed, resolve as condições
// e troca as variáveis pelos dados do contato.
//
// `agora`: se fornecido, resolve `{{saudacao}}` pela hora dada (usado no preview
// do editor). Se omitido — caso do enfileiramento — o token `{{saudacao}}` fica
// intacto e o worker o resolve na hora REAL do envio. Enfileirar 9h e enviar 15h
// não pode dizer "Bom dia".
export function renderiza(
  msg: string,
  seed: number,
  contato: DadosContato,
  agora?: Date,
): string {
  const temValor = (campo: string) =>
    campo === 'saudacao' ? true : valorVar(campo, contato).trim().length > 0;

  // 1. condicionais de presença
  let out = msg
    .replace(RE_SE, (_all, campo: string, corpo: string) => (temValor(campo) ? corpo : ''))
    .replace(RE_SEM, (_all, campo: string, corpo: string) => (temValor(campo) ? '' : corpo));

  // 2. variáveis com fallback
  out = out.replace(RE_VAR, (_all, campo: string, padrao: string | undefined) => {
    if (campo === 'saudacao') {
      // Preview: resolve. Enfileiramento: preserva o token (normalizado) pro
      // worker resolver na hora do envio.
      return agora ? saudacaoDe(agora) : '{{saudacao}}';
    }
    const v = valorVar(campo, contato);
    if (v.trim().length > 0) return v;
    return padrao ?? '';
  });

  // 3. spintax
  let i = 0;
  out = out.replace(RE_GRUPO, (_all, grupo: string) => {
    const ops = grupo.split('|');
    const idx = Math.abs(seed + i) % ops.length;
    i += 1;
    return ops[idx];
  });

  return out;
}
