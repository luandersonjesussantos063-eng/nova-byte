// One-time, fail-closed migration of public Kaia Glow product photos.
// Run only with permission to preserve public catalog images in the project's repository.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalogFile = path.join(root, 'kaia-glow', 'catalog.js');
const destRoot = path.join(root, 'kaia-glow', 'assets', 'catalog');
const manifestFile = path.join(root, 'docs', 'kaia-glow-image-manifest.json');
const prefix = 'window.KAIA_CATALOG=';
const source = (await readFile(catalogFile, 'utf8')).trim();
if (!source.startsWith(prefix) || !source.endsWith(';')) throw new Error('Formato do catálogo inesperado; operação abortada.');
const catalog = JSON.parse(source.slice(prefix.length, -1));
if (!Array.isArray(catalog) || catalog.length === 0) throw new Error('Catálogo vazio.');
const urls = [...new Set(catalog.flatMap(p => p.images || []).filter(u => /^https:/i.test(u)))];
const fromNuvem = urls.filter(u => new URL(u).hostname === 'dcdn-us.mitiendanube.com');
if (urls.length !== fromNuvem.length) throw new Error('Fontes HTTPS externas não previstas: revisão humana necessária.');
if (!fromNuvem.length) { console.log('Catálogo não contém imagens externas para migrar.'); process.exit(0); }
console.log('Iniciando cópia autorizada de', fromNuvem.length, 'imagens públicas de', catalog.length, 'produtos.');
await mkdir(destRoot, { recursive: true });

const formats = [
  { type: 'image/webp', ext: 'webp', valid: b => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { type: 'image/jpeg', ext: 'jpg', valid: b => b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255 },
  { type: 'image/png', ext: 'png', valid: b => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }
];
const paths = new Map();
let count = 0;
async function migrate(url) {
  const original = new URL(url);
  if (original.protocol !== 'https:' || original.hostname !== 'dcdn-us.mitiendanube.com') throw new Error('Domínio de imagem não permitido.');
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(26000), redirect: 'follow', headers: { Accept: 'image/webp,image/png,image/jpeg' } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== original.hostname) throw new Error('Redirecionamento de mídia fora do domínio permitido.');
      const type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      const fmt = formats.find(f => f.type === type);
      if (!fmt) throw new Error('Formato de mídia não permitido: ' + type);
      const statedSize = Number(response.headers.get('content-length') || 0);
      if (statedSize > 10 * 1024 * 1024) throw new Error('Arquivo acima de 10 MiB');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 20 || bytes.length > 10 * 1024 * 1024 || !fmt.valid(bytes)) throw new Error('Imagem inválida ou arquivo grande demais');
      const hash = createHash('sha256').update(url).digest('hex').slice(0, 24);
      const relative = 'assets/catalog/' + hash + '.' + fmt.ext;
      const file = path.join(destRoot, hash + '.' + fmt.ext);
      await writeFile(file, bytes);
      const check = await stat(file);
      if (check.size !== bytes.length) throw new Error('Falha de integridade na gravação');
      paths.set(url, relative);
      count++;
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
  throw new Error('Falha no download ' + original.pathname.split('/').at(-1) + ': ' + lastError?.message);
}
const failures = [];
let cursor = 0;
async function worker() {
  while (cursor < fromNuvem.length) {
    const index = cursor++;
    try { await migrate(fromNuvem[index]); }
    catch (error) { failures.push(error.message); }
  }
}
await Promise.all(Array.from({ length: Math.min(6, fromNuvem.length) }, worker));
if (failures.length) throw new Error(failures.length + ' downloads falharam; catálogo não foi alterado. Exemplos: ' + failures.slice(0, 5).join(' | '));
for (const p of catalog) p.images = p.images.map(u => paths.get(u) || u);
if (catalog.some(p => p.images.some(u => /^https:/.test(u)))) throw new Error('Ainda existem URLs externas; catálogo não foi alterado.');
await writeFile(catalogFile, prefix + JSON.stringify(catalog) + ';\n');
await writeFile(manifestFile, JSON.stringify({ description: 'Fotos públicas migradas para arquivos estáticos da Kaia Glow; preços, estoque e pesos ainda precisam de conferência.', sourceHost: 'dcdn-us.mitiendanube.com', count, images: Object.fromEntries(paths) }, null, 2) + '\n');
console.log('MIGRAÇÃO CONCLUÍDA:', count, 'imagens; URLs locais em catalog.js, manifesto salvo.');
