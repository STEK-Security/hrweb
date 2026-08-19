// Inlines a Vite `dist/` build into a single self-contained `hr-app.html`.
// Run after `vite build` via `bun run build:single`.
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const outFile = path.join(root, 'hr-app.html');

const MIME_BY_EXT = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

// Escape `</script>` so an inlined JS string/comment containing it can't
// terminate the surrounding <script> tag early.
function escapeScriptClose(code) {
  return code.replace(/<\/script/gi, () => '<\\/script');
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const assetsDir = path.join(distDir, 'assets');
let assetFiles = [];
try {
  assetFiles = walk(assetsDir);
} catch {
  // no assets dir at all — nothing to inline
}

const jsFiles = new Map(); // basename -> content string
const cssFiles = new Map();
const binaryFiles = new Map(); // basename -> data: URI

for (const full of assetFiles) {
  const ext = path.extname(full).toLowerCase();
  const base = path.basename(full);
  if (ext === '.js' || ext === '.mjs') {
    jsFiles.set(base, readFileSync(full, 'utf8'));
  } else if (ext === '.css') {
    cssFiles.set(base, readFileSync(full, 'utf8'));
  } else if (MIME_BY_EXT[ext]) {
    const buf = readFileSync(full);
    binaryFiles.set(base, `data:${MIME_BY_EXT[ext]};base64,${buf.toString('base64')}`);
  }
}

// Replace any reference to a binary asset filename inside JS/CSS content
// with its base64 data URI, so fonts/images survive being embedded.
function inlineBinaryRefs(content) {
  let result = content;
  for (const [base, dataUri] of binaryFiles) {
    if (result.includes(base)) {
      // Match optional relative path prefixes ("./assets/", "/assets/", "assets/")
      // immediately before the filename.
      const re = new RegExp(`(?:\\.?\\/?(?:assets\\/)?)${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      result = result.split(re).join(dataUri);
    }
  }
  return result;
}

let html = readFileSync(path.join(distDir, 'index.html'), 'utf8');

function basenameFromRef(ref) {
  return path.basename(ref.split('?')[0].split('#')[0]);
}

// Inline <script type="module" ... src="...assets/xxx.js"></script>
html = html.replace(
  /<script\b([^>]*)\ssrc="([^"]+\.m?js)"([^>]*)>\s*<\/script>/g,
  (match, before, src, after) => {
    const base = basenameFromRef(src);
    const content = jsFiles.get(base);
    if (content === undefined) return match;
    const inlined = escapeScriptClose(inlineBinaryRefs(content));
    return `<script type="module">\n${inlined}\n</script>`;
  }
);

// Inline <link rel="stylesheet" ... href="...assets/xxx.css">
html = html.replace(
  /<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+\.css)"[^>]*\/?>/g,
  (match, href) => {
    const base = basenameFromRef(href);
    const content = cssFiles.get(base);
    if (content === undefined) return match;
    return `<style>\n${inlineBinaryRefs(content)}\n</style>`;
  }
);

// Drop modulepreload hints — nothing left to preload once JS is inlined.
html = html.replace(/<link\b[^>]*\brel="modulepreload"[^>]*\/?>\s*/g, '');

writeFileSync(outFile, html, 'utf8');

const sizeKb = (statSync(outFile).size / 1024).toFixed(1);
console.log(`Wrote ${outFile} (${sizeKb} KB)`);
