import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { normalizaTelefone } from '@/lib/telefone';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Acha a coluna cujo cabeçalho casa com algum dos termos (case/acento-insensível).
function achaCol(headers: string[], termos: string[]): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i] ?? '');
    if (termos.some((t) => h.includes(t))) return i;
  }
  return -1;
}

function celula(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    // hyperlink / rich text / formula result
    const anyv = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (anyv.richText) return anyv.richText.map((r) => r.text).join('');
    if (anyv.text) return String(anyv.text);
    if (anyv.result != null) return String(anyv.result);
  }
  return String(v);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('arquivo');
  const segmentoTag = (form.get('segmento') as string | null)?.trim() || '';
  const cadastradoPor = (form.get('por') as string | null)?.trim() || null;
  // Nicho e cidade costumam ser constantes por lote (o print é de "nicho em
  // cidade"): default do lote, aplicado quando a planilha não traz a coluna.
  const cidadeTag = (form.get('cidade') as string | null)?.trim() || '';
  const nichoTag = (form.get('nicho') as string | null)?.trim() || '';

  if (!(file instanceof File)) {
    return NextResponse.json({ erro: 'Nenhum arquivo enviado.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  try {
    // @types/node (v22) Buffer é genérico; exceljs espera o Buffer legado.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
  } catch {
    return NextResponse.json(
      { erro: 'Não consegui ler o arquivo. Ele é um .xlsx válido?' },
      { status: 400 },
    );
  }
  const ws = wb.worksheets[0];
  if (!ws) {
    return NextResponse.json({ erro: 'Planilha vazia.' }, { status: 400 });
  }

  // Cabeçalho = primeira linha.
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = celula(cell.value);
  });

  const colNome = achaCol(headers, ['nome', 'empresa', 'contato', 'razao']);
  const colTel = achaCol(headers, ['telefone', 'fone', 'whatsapp', 'celular', 'zap']);
  const colSeg = achaCol(headers, ['segmento']);
  const colCidade = achaCol(headers, ['cidade', 'municipio']);
  const colNicho = achaCol(headers, ['nicho', 'ramo', 'categoria']);
  const colData = achaCol(headers, ['optin_data', 'data opt', 'optin data', 'data_optin']);
  const colOrigem = achaCol(headers, ['optin_origem', 'origem']);
  const colPor = achaCol(headers, ['optin_por', 'cadastrado', 'quem']);

  if (colTel < 0) {
    return NextResponse.json(
      {
        erro:
          'Não encontrei a coluna de telefone. Cabeçalhos aceitos: Telefone, Celular, WhatsApp, Fone.',
        cabecalhos: headers,
      },
      { status: 400 },
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const origemPadrao = `Importação · ${file.name}`;

  const resumo = {
    linhas: 0,
    importados: 0,
    atualizados: 0,
    semTelefone: 0,
    duplicadosNoArquivo: 0,
    mobiles: 0,
    fixos: 0,
    invalidos: 0,
  };

  const vistosNoArquivo = new Set<string>();

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const bruto = colTel >= 0 ? celula(row.getCell(colTel + 1).value) : '';
    const nome =
      (colNome >= 0 ? celula(row.getCell(colNome + 1).value) : '').trim() || 'Sem nome';

    const telSujo = bruto.trim();
    // Linha totalmente vazia -> ignora sem contar.
    if (!telSujo && (colNome < 0 || nome === 'Sem nome')) continue;
    resumo.linhas++;

    if (!telSujo || /sem\s*info/i.test(telSujo) || telSujo.replace(/\D/g, '').length < 8) {
      resumo.semTelefone++;
      continue;
    }

    const tel = normalizaTelefone(telSujo);
    const chave = tel.normalizado || telSujo.replace(/\D/g, '');
    if (vistosNoArquivo.has(chave)) {
      resumo.duplicadosNoArquivo++;
      continue;
    }
    vistosNoArquivo.add(chave);

    if (tel.tipo === 'mobile') resumo.mobiles++;
    else if (tel.tipo === 'fixo') {
      // Fixo não tem WhatsApp — descartado na importação, não vai pro banco.
      resumo.fixos++;
      continue;
    } else resumo.invalidos++;

    const seg = [
      colSeg >= 0 ? celula(row.getCell(colSeg + 1).value).trim() : '',
      segmentoTag,
    ]
      .filter(Boolean)
      .join(',');

    // Coluna se existir, senão o default do lote. empresa = nome do negócio.
    const cidade = (colCidade >= 0 ? celula(row.getCell(colCidade + 1).value).trim() : '') || cidadeTag;
    const nicho = (colNicho >= 0 ? celula(row.getCell(colNicho + 1).value).trim() : '') || nichoTag;
    const empresa = nome !== 'Sem nome' ? nome : '';

    const optinData = colData >= 0 ? celula(row.getCell(colData + 1).value).trim() : '';
    const optinOrigem = colOrigem >= 0 ? celula(row.getCell(colOrigem + 1).value).trim() : '';
    const optinPor = colPor >= 0 ? celula(row.getCell(colPor + 1).value).trim() : '';

    const existente = await prisma.contato.findUnique({ where: { telefone: chave } });

    if (existente) {
      // Não ressuscita opt-out; não sobrescreve opt-in já preenchido.
      const segMerge = Array.from(
        new Set(
          [...(existente.segmentos ? existente.segmentos.split(',') : []), ...seg.split(',')].filter(
            Boolean,
          ),
        ),
      ).join(',');
      await prisma.contato.update({
        where: { id: existente.id },
        data: {
          nome: nome !== 'Sem nome' ? nome : existente.nome,
          telefoneRaw: telSujo,
          tipo: tel.tipo,
          segmentos: segMerge,
          // Não sobrescreve o que já existe; só preenche o que está vazio.
          cidade: existente.cidade || cidade || null,
          nicho: existente.nicho || nicho || null,
          empresa: existente.empresa || empresa || null,
          optinData: existente.optinData || optinData || hoje,
          optinOrigem: existente.optinOrigem || optinOrigem || origemPadrao,
          optinPor: existente.optinPor || optinPor || cadastradoPor,
        },
      });
      resumo.atualizados++;
    } else {
      await prisma.contato.create({
        data: {
          nome,
          telefone: chave,
          telefoneRaw: telSujo,
          tipo: tel.tipo,
          segmentos: seg,
          cidade: cidade || null,
          nicho: nicho || null,
          empresa: empresa || null,
          optinData: optinData || hoje,
          optinOrigem: optinOrigem || origemPadrao,
          optinPor: optinPor || cadastradoPor,
          status: 'ativo',
        },
      });
      resumo.importados++;
    }
  }

  return NextResponse.json({ ok: true, resumo });
}
