// Builds the public site folder from the mockups (main page, geo, calendar), with the data encrypted by a password.
// Usage: node tools/build-site.mjs [password]
// With no password, reuses the one in site-password.txt (git-ignored) or creates a new one there.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'mockups');
const out = path.join(root, 'site');
const pwFile = path.join(root, 'site-password.txt');

let password = process.argv[2];
if (!password && fs.existsSync(pwFile)) password = fs.readFileSync(pwFile, 'utf8').trim();
if (!password) {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const pick = () => Array.from(crypto.randomBytes(4), b => abc[b % abc.length]).join('');
  password = `${pick()}-${pick()}-${pick()}`;
}
fs.writeFileSync(pwFile, password + '\n');

// Encrypt: gzip -> AES-256-GCM, key from PBKDF2-SHA256
const dataJs = fs.readFileSync(path.join(src, 'data.js'), 'utf8');
const json = dataJs.slice(dataJs.indexOf('=') + 1).trim().replace(/;$/, '');
JSON.parse(json);
const iter = 310000;
const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(password, salt, iter, 32, 'sha256');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([cipher.update(zlib.gzipSync(json, { level: 9 })), cipher.final(), cipher.getAuthTag()]);
const enc = { iter, salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64') };

// Split the page: the inline app script becomes app.js, loaded only after the data is unlocked
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });

// Each page: its inline script becomes appName, loaded only after the data is unlocked.
// links: page names in mockups -> their names on the site
const links = { 'mockup-3-analytical.html': 'index.html' };
function buildPage(srcName, outName, appName) {
let html = fs.readFileSync(path.join(src, srcName), 'utf8');
const tail = html.match(/<script src="data\.js"><\/script>\s*<script src="common\.js"><\/script>\s*(<script src="[^"]+chart[^"]+"><\/script>\s*)?<script>([\s\S]*?)<\/script>/);
if (!tail) throw new Error(srcName + ': script block not found');
const appJs = tail[2];
const gateJs = `
(function () {
  const E = window.FLACAR_ENC, KEY = 'flacar-key', TTL = 12 * 3600 * 1000;
  const gate = document.getElementById('gate'), boot = document.getElementById('bootbar');
  const form = document.getElementById('gate-form'), pw = document.getElementById('gate-pw'), err = document.getElementById('gate-err'), btn = form.querySelector('button');
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  try { localStorage.removeItem('flacar-pw'); } catch (e) {}
  function load(src) { return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.body.appendChild(s); }); }
  async function open(key) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(E.iv) }, key, b64(E.ct));
    const text = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    window.FLACAR_DATA = JSON.parse(text);
    gate.hidden = true;
    await load('common.js');
    await load('${appName}');
    boot.hidden = true;
  }
  // The slow step (deriving the key from the password) runs once; the key is kept on this device
  // for 12 hours, so other pages open straight away without the password screen
  async function withPassword(p) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(E.salt), iterations: E.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
    await open(key);
    try { localStorage.setItem(KEY, JSON.stringify({ k: toB64(await crypto.subtle.exportKey('raw', key)), s: E.salt, t: Date.now() })); } catch (e) {}
  }
  function showForm() { gate.classList.remove('auto'); boot.hidden = true; pw.focus(); }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!pw.value) return;
    btn.disabled = true; btn.textContent = 'פותח…'; err.textContent = '';
    try { await withPassword(pw.value); }
    catch (x) { err.textContent = 'הסיסמה שגויה. נסו שוב.'; pw.select(); }
    btn.disabled = false; btn.textContent = 'כניסה';
  });
  let saved = null;
  try {
    const m = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (m && m.s === E.salt && Date.now() - m.t < TTL) saved = m.k;
  } catch (e) {}
  if (!saved) return showForm();
  crypto.subtle.importKey('raw', b64(saved), 'AES-GCM', false, ['decrypt']).then(open)
    .catch(() => { try { localStorage.removeItem(KEY); } catch (e) {} showForm(); });
})();
`;
html = html.replace(tail[0], `<script src="data.enc.js"></script>\n${tail[1] || ''}\n<script>${gateJs}</script>`);
for (const [from, to] of Object.entries(links)) html = html.split(`href="${from}`).join(`href="${to}`);
html = html.replace(/<title>[^<]*<\/title>/, '<title>ניתוח הזמנות פלאקאר</title>\n<meta name="robots" content="noindex, nofollow">');
html = html.replace('</style>', `  .gate{position:fixed;inset:0;z-index:50;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:16px}
  .gate[hidden],.gate.auto{display:none}
  .bootbar{position:fixed;top:0;left:0;right:0;height:3px;z-index:60;overflow:hidden;background:transparent}
  .bootbar[hidden]{display:none}
  .bootbar::after{content:"";position:absolute;inset:0 auto 0 0;width:35%;background:var(--accent);animation:boot 1s ease-in-out infinite}
  @keyframes boot{from{transform:translateX(-100%)}to{transform:translateX(300%)}}
  /* Netlify pins its badge to the bottom corner; room at the end lets the last rows scroll clear of it */
  body{padding-bottom:88px}
  .gate form{background:var(--card);border-radius:14px;padding:28px 26px;width:100%;max-width:360px;display:flex;flex-direction:column;gap:12px;box-shadow:0 8px 30px rgba(20,30,50,.12);border-top:4px solid var(--accent)}
  .gate img{height:52px;align-self:center}
  .gate h2{margin:0;font-size:18px;text-align:center}
  .gate p{margin:0;font-size:13px;color:var(--ink-3);text-align:center}
  .gate input{font:inherit;font-size:15px;padding:10px 12px;border:1px solid #d3d9e2;border-radius:8px;direction:ltr;text-align:center}
  .gate input:focus{outline:2px solid var(--accent);outline-offset:-1px}
  .gate button{font:inherit;font-size:15px;font-weight:600;padding:10px;border:0;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer}
  .gate button:disabled{opacity:.6;cursor:wait}
  .gate .err{color:var(--down);font-size:13px;min-height:18px;text-align:center}
</style>`);
// The gate starts hidden and is shown only when no saved key exists, so moving between pages never flashes it
html = html.replace('<body>', `<body>
<div class="bootbar" id="bootbar"></div>
<div class="gate auto" id="gate">
  <form id="gate-form" autocomplete="off">
    <img src="assets/logo.jpg" alt="לוגו פלאקאר">
    <h2>ניתוח הזמנות</h2>
    <p>הנתונים מוצפנים. הזינו סיסמה כדי לצפות.</p>
    <input id="gate-pw" type="password" placeholder="סיסמה" aria-label="סיסמה" autocomplete="current-password">
    <button type="submit">כניסה</button>
    <div class="err" id="gate-err" role="alert"></div>
  </form>
</div>
<script>(function () { var ok = false; try { var m = JSON.parse(localStorage.getItem('flacar-key') || 'null'); ok = !!(m && Date.now() - m.t < 12 * 3600 * 1000); } catch (e) {} if (!ok) document.getElementById('gate').classList.remove('auto'); })();</script>`);

fs.writeFileSync(path.join(out, outName), html);
fs.writeFileSync(path.join(out, appName), appJs);
}
buildPage('mockup-3-analytical.html', 'index.html', 'app.js');
buildPage('geo.html', 'geo.html', 'geo-app.js');
buildPage('calendar.html', 'calendar.html', 'calendar-app.js');
fs.writeFileSync(path.join(out, 'data.enc.js'), 'window.FLACAR_ENC = ' + JSON.stringify(enc) + ';\n');
fs.copyFileSync(path.join(src, 'common.js'), path.join(out, 'common.js'));
fs.copyFileSync(path.join(src, 'assets', 'logo.jpg'), path.join(out, 'assets', 'logo.jpg'));
for (const f of fs.readdirSync(out)) {
  const p = path.join(out, f);
  if (fs.statSync(p).isFile()) console.log(f.padEnd(14), (fs.statSync(p).size / 1024).toFixed(0) + ' KB');
}
console.log('Password saved to site-password.txt');
