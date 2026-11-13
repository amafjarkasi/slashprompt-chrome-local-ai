import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const distDir = path.join(root, 'dist');
const publicDir = path.join(root, 'public');

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(path.join(distDir, 'icons'), { recursive: true });

// Build self-contained bundles for MV3: content (IIFE), background (ESM), popup (ESM)
const entries = [
  { name: 'content', input: path.join(root, 'src/content/index.ts'), format: 'iife' },
  { name: 'background', input: path.join(root, 'src/background/index.ts'), format: 'es' },
  { name: 'popup', input: path.join(root, 'src/popup/popup.ts'), format: 'es' },
];

for (const entry of entries) {
  await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      outDir: distDir,
      emptyOutDir: false,
      minify: 'esbuild',
      sourcemap: false,
      lib: {
        entry: entry.input,
        name: `SlashPrompt_${entry.name}`,
        formats: [entry.format],
        fileName: () => `${entry.name}.js`,
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });
}

// Copy static files
fs.copyFileSync(path.join(publicDir, 'manifest.json'), path.join(distDir, 'manifest.json'));
fs.copyFileSync(path.join(publicDir, 'popup.html'), path.join(distDir, 'popup.html'));
fs.copyFileSync(path.join(root, 'src/popup/popup.css'), path.join(distDir, 'popup.css'));

// Generate crisp minimal PNG icons (16, 32, 48, 128)
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createMinimalIconPng(size) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      // Rounded square dark zinc (#18181b) with subtle white "//" slash motif
      const dx = Math.abs(x + 0.5 - r);
      const dy = Math.abs(y + 0.5 - r);
      const corner = size * 0.24;
      const inBox =
        dx <= r - 0.5 &&
        dy <= r - 0.5 &&
        !(dx > r - corner && dy > r - corner && Math.hypot(dx - (r - corner), dy - (r - corner)) > corner);

      if (!inBox) {
        raw[idx] = 0;
        raw[idx + 1] = 0;
        raw[idx + 2] = 0;
        raw[idx + 3] = 0;
        continue;
      }

      // Draw two crisp diagonal slashes "//"
      const nx = x / size;
      const ny = y / size;
      const onSlash1 = Math.abs(nx + ny * 0.45 - 0.58) < 0.075 && ny > 0.24 && ny < 0.76;
      const onSlash2 = Math.abs(nx + ny * 0.45 - 0.80) < 0.075 && ny > 0.24 && ny < 0.76;

      if (onSlash1 || onSlash2) {
        raw[idx] = 250;
        raw[idx + 1] = 250;
        raw[idx + 2] = 250;
        raw[idx + 3] = 255;
      } else {
        raw[idx] = 24;
        raw[idx + 1] = 24;
        raw[idx + 2] = 27;
        raw[idx + 3] = 255;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(distDir, 'icons', `icon${size}.png`), createMinimalIconPng(size));
}

console.log('Built SlashPrompt extension to dist/');
