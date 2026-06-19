// Build pipeline: bundle TS -> single self-contained JS, copy static shell, gen icons.
// Output in dist/ uses ONLY relative paths so it deploys to GitHub Pages subpaths.
import esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const watch = process.argv.includes('--watch');
const serve = process.argv.includes('--serve');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const STATIC = ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js'];
function copyStatic() {
  for (const f of STATIC) {
    const src = join(root, 'static', f);
    if (existsSync(src)) cpSync(src, join(dist, f));
  }
  // neighborhood backdrop art (static/art/*.webp) -> dist/art/
  const art = join(root, 'static', 'art');
  if (existsSync(art)) cpSync(art, join(dist, 'art'), { recursive: true });
}
function genIcons() {
  execFileSync(process.execPath, [join(root, 'tools', 'gen-icons.mjs'), join(dist, 'icons')], {
    stdio: 'inherit',
  });
}

const buildOptions = {
  entryPoints: [join(root, 'src', 'main.ts')],
  bundle: true,
  format: 'iife',
  target: ['es2019'],
  outfile: join(dist, 'app.js'),
  sourcemap: true,
  minify: !watch,
  legalComments: 'none',
  logLevel: 'info',
};

copyStatic();
genIcons();

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('[build] watching for changes...');
} else {
  await esbuild.build(buildOptions);
  console.log('[build] done ->', dist);
}

if (serve) {
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.png': 'image/png',
    '.map': 'application/json',
  };
  const port = 8123;
  createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = normalize(join(dist, urlPath));
    if (!filePath.startsWith(dist) || !existsSync(filePath)) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  }).listen(port, () => console.log(`[serve] http://localhost:${port}`));
}
