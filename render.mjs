// usage: node render.mjs <scene> [--fps 24] [--w 1600 --h 900] [--aa 0 --fxaa 1]
//          [--from s --to s] [--out file.mp4] [--stills t1,t2,...]
// Renders scenes/<scene>.js headlessly (Chromium + SwiftShader, no GPU needed), frame by frame.
// Frames are cached in out/frames/<scene>_<W>/ so an interrupted render resumes where it stopped.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { // fall back to a globally installed playwright
  const { execSync } = await import('node:child_process');
  ({ chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright')); }

const args = process.argv.slice(2);
const scene = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const fps = +opt('fps', 30), W = +opt('w', 1280), H = +opt('h', 720);
const out = opt('out', `out/${scene}.mp4`);
const stills = opt('stills', null);
const root = path.dirname(new URL(import.meta.url).pathname);

const types = { '.js': 'text/javascript', '.html': 'text/html', '.mjs': 'text/javascript' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);
const port = srv.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/index.html?scene=${scene}&w=${W}&h=${H}&aa=${opt('aa','1')}&soft=${opt('soft','1')}&fxaa=${opt('fxaa','0')}`);
await page.waitForFunction(() => window.READY || window.ERR, null, { timeout: 300000 });
const err = await page.evaluate(() => window.ERR);
if (err) { console.error(err); process.exit(1); }
const DUR = await page.evaluate(() => window.DUR);
fs.mkdirSync(path.dirname(out), { recursive: true });

const grab = async (t) => {
  const url = await page.evaluate((t) => { window.renderAt(t); return window.grab(); }, t);
  return Buffer.from(url.split(',')[1], 'base64');
};

if (opt('bench', null)) {
  await grab(1);
  for (const t of [2, 3]) { const t0 = Date.now(); await grab(t); console.log('frame ms', Date.now() - t0); }
} else if (stills) {
  for (const s of stills.split(',')) {
    const t = +s; const buf = await grab(t);
    fs.writeFileSync(`out/${scene}_${s}.jpg`, buf); console.log('still', t);
  }
} else {
  const N = Math.round(+opt('to', DUR) * fps), I0 = Math.round(+opt('from', 0) * fps);
  const dir = opt('dir', `out/frames/${scene}_${W}`); fs.mkdirSync(dir, { recursive: true });
  const t0 = Date.now(); let done = 0;
  for (let i = I0; i < N; i++) {
    const f = `${dir}/${String(i).padStart(5, '0')}.jpg`;
    if (fs.existsSync(f)) continue;
    const buf = await grab(i / fps); fs.writeFileSync(f + '.tmp', buf); fs.renameSync(f + '.tmp', f); done++;
    if (i % 24 === 0) console.log(`${scene} ${i}/${N} ${((Date.now() - t0) / 1000 / done).toFixed(2)}s/f`);
  }
  await new Promise((res) => spawn('ffmpeg', ['-y', '-v', 'error', '-framerate', String(fps), '-start_number', String(I0), '-i', `${dir}/%05d.jpg`,
    '-vf', 'vignette=PI/5,noise=alls=5:allf=t', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' }).on('close', res));
  console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
await browser.close(); srv.close();
