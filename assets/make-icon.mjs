// Gera assets/icon.ico (multi-resolução) e assets/icon.png (512) a partir do
// icon.svg, pro electron-builder (janela + instalador). Rodar: node assets/make-icon.mjs
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(dir, 'icon.svg'));

const sizes = [256, 128, 64, 48, 32, 16];
const pngs = await Promise.all(
  sizes.map((s) => sharp(svg).resize(s, s).png().toBuffer())
);

// .ico multi-resolução (Windows escolhe o tamanho por contexto)
writeFileSync(join(dir, 'icon.ico'), await pngToIco(pngs));

// .png 512 — fallback e uso geral
await sharp(svg).resize(512, 512).png().toFile(join(dir, 'icon.png'));

console.log('icon.ico + icon.png gerados de', join(dir, 'icon.svg'));
