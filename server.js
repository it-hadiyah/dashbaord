'use strict';
// خادم بدون مكتبات خارجية وبدون قاعدة بيانات: كل تقرير يُحفظ كملف JSON داخل مجلد reports،
// وصفحة العرض تُولَّد منه عند الطلب (فتنعكس تحديثات التصميم والكليشة على التقارير القديمة).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const T = require('./public/shared/templates.js');
const C = require('./public/shared/calc.js');
const R = require('./public/shared/render.js');
const cfgm = require('./lib/config');
const auth = require('./lib/auth');
const WF = require('./lib/workflow');
const store = require('./lib/store');
const SH = require('./lib/shares');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const REPORTS_DIR = path.join(__dirname, 'reports');
const MAX_BODY = 24 * 1024 * 1024;
const MAX_IMAGE = 3 * 1024 * 1024;
const ID_RE = /^[a-z0-9-]{3,40}$/;
const slug = (v) => (R.SLUG.test(String(v || '')) ? String(v) : '');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

const loadConfig = () => { const c = cfgm.get(); const { auth: _a, ...pub } = c; return pub; };

/* ---------- التحقق من البيانات وتنظيفها ---------- */
const str = (v, max = 5000) => String(v == null ? '' : v).slice(0, max);
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

function cleanContent(type, c) {
  c = c == null ? {} : c;
  switch (type) {
    case 'text': return R.sanitize(str(c, 60000));
    case 'list': return { ordered: !!c.ordered, items: arr(c.items, 300).map((i) => str(i, 600)) };
    case 'table': return {
      zebra: c.zebra !== false, heat: !!c.heat,
      headers: arr(c.headers, 12).map((h) => str(h, 200)),
      rows: arr(c.rows, 500).map((r) => arr(r, 12).map((x) => str(x, 1000))),
    };
    case 'kpi': return { style: c.style === 'highlights' ? 'highlights' : 'cards', items: arr(c.items, 24).map((k) => ({ icon: slug(k && k.icon), label: str(k && k.label, 200), value: str(k && k.value, 100), trend: str(k && k.trend, 30) })) };
    case 'chart': return {
      kind: ['bar', 'line', 'area', 'donut', 'pie', 'hbar', 'waterfall', 'gauge', 'radar', 'funnel'].includes(c.kind) ? c.kind : 'bar', unit: str(c.unit, 20), max: str(c.max, 20),
      data: arr(c.data, 60).map((d) => ({ label: str(d && d.label, 200), value: str(d && d.value, 50) })),
    };
    case 'progress': return { items: arr(c.items, 30).map((i) => ({ label: str(i && i.label, 200), value: str(i && i.value, 20) })) };
    case 'timeline': return { items: arr(c.items, 60).map((i) => ({ date: str(i && i.date, 100), title: str(i && i.title, 300), desc: str(i && i.desc, 1000), status: ['done', 'active', 'todo'].includes(i && i.status) ? i.status : 'todo' })) };
    case 'image': {
      const src = str(c.src, MAX_IMAGE * 1.4);
      return { src: R.SAFE_IMG.test(src) && src.length <= MAX_IMAGE * 1.4 ? src : '', caption: str(c.caption, 300), fit: c.fit === 'cover' ? 'cover' : 'contain', height: Math.max(60, Math.min(600, parseInt(c.height, 10) || 220)) };
    }
    case 'gantt': return { items: arr(c.items, 60).map((i) => ({ name: str(i && i.name, 200), start: /^\d{4}-\d{2}-\d{2}$/.test(String(i && i.start)) ? i.start : '', end: /^\d{4}-\d{2}-\d{2}$/.test(String(i && i.end)) ? i.end : '', progress: str(i && i.progress, 6), owner: str(i && i.owner, 100) })) };
    case 'calc': {
      const used = new Set(); const rows = [];
      for (const r of arr(c.rows, 26)) {
        let key = /^[A-Z]$/.test(String(r && r.key)) && !used.has(r.key) ? r.key : C.nextKey(rows.map((x) => ({ key: x.key })).concat([...used].map((k) => ({ key: k }))));
        if (!key) break; used.add(key);
        rows.push({ key, label: str(r && r.label, 120), kind: r && r.kind === 'calc' ? 'calc' : 'input', value: str(r && r.value, 40), unit: str(r && r.unit, 20), fmt: r && r.fmt === 'percent' ? 'percent' : 'number',
          op: Object.keys(C.OPS).includes(r && r.op) ? r.op : 'sub', args: arr(r && r.args, 12).map(String).filter((a) => /^[A-Z]$/.test(a)), formula: str(r && r.formula, 200) });
      }
      return { style: c.style === 'cards' ? 'cards' : 'table', rows };
    }
    case 'compare': return {
      labels: { prev: str(c.labels && c.labels.prev, 60) || 'السنة الماضية', curr: str(c.labels && c.labels.curr, 60) || 'السنة الحالية' },
      rows: arr(c.rows, 12).map((r) => ({ label: str(r && r.label, 120), prev: str(r && r.prev, 40), curr: str(r && r.curr, 40), unit: str(r && r.unit, 20), better: r && r.better === 'down' ? 'down' : 'up' })),
      chart: c.chart !== false, summary: c.summary !== false, decimals: [0, 1, 2].includes(c.decimals) ? c.decimals : 1,
    };
    case 'callout': return { tone: ['info', 'success', 'warn'].includes(c.tone) ? c.tone : 'info', text: str(c.text, 3000) };
    default: return {};
  }
}

function cleanSection(s) {
  const type = T.TYPES.includes(s && s.type) ? s.type : 'text';
  return { id: /^[A-Za-z0-9_-]{1,40}$/.test(s && s.id) ? s.id : T.uid(), type, title: str(s && s.title, 200), icon: slug(s && s.icon), visible: !(s && s.visible === false), width: s && s.width === 'half' ? 'half' : 'full', hint: str(s && s.hint, 300), content: cleanContent(type, s && s.content) };
}

function clean(d) {
  d = T.migrate(d || {});
  const o = d.options || {};
  return {
    version: 2, id: d.id || null,
    template: T.TEMPLATES.some((t) => t.id === d.template) ? d.template : 'blank',
    palette: T.PALETTES[d.palette] ? d.palette : 'green', sample: !!d.sample,
    title: str(d.title, 200), subtitle: str(d.subtitle, 300), period: str(d.period, 120),
    employee: str(d.employee, 200), department: str(d.department, 200), date: str(d.date, 30),
    options: {
      cover: o.cover !== false, toc: !!o.toc, closing: !!o.closing, header: o.header !== false, pageNumbers: o.pageNumbers !== false,
      margins: ['narrow', 'normal', 'wide'].includes(o.margins) ? o.margins : 'normal', coverIcon: slug(o.coverIcon), footerText: str(o.footerText, 300), arabicDigits: !!o.arabicDigits,
    },
    sections: arr(d.sections, 80).map(cleanSection),
  };
}

/* ---------- أدوات HTTP ---------- */
function send(res, code, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(code, Object.assign({ 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' }, extra));
  res.end(body);
}
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), MIME['.json'], { 'Cache-Control': 'no-store' });

function readBody(req, max = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > max) { reject(new Error('too large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveStatic(res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (e) { return send(res, 400, 'طلب غير صالح'); }
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'ممنوع');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'غير موجود');
    const ext = path.extname(file).toLowerCase();
    send(res, 200, data, MIME[ext] || 'application/octet-stream', { 'Cache-Control': ext === '.woff2' ? 'public, max-age=31536000, immutable' : 'no-cache' });
  });
}

/* ---------- التقارير ---------- */
const fileOf = (id) => path.join(REPORTS_DIR, id + '.json');

function toReport(raw, id) {
  const d = T.migrate(raw);
  d.id = id; d.owner = raw.owner || ''; d.ownerName = raw.ownerName || '';
  d.workflow = raw.workflow || { status: 'draft' }; d.history = raw.history || [];
  d.createdAt = raw.createdAt; d.updatedAt = raw.updatedAt;
  return d;
}
async function readReport(id) { return toReport(JSON.parse(await fs.promises.readFile(fileOf(id), 'utf8')), id); }

async function writeReport(id, content, meta) {
  const d = Object.assign(clean(content), meta, { id });
  const tmp = fileOf(id) + '.tmp';
  await fs.promises.writeFile(tmp, JSON.stringify(d, null, 2));
  await fs.promises.rename(tmp, fileOf(id));
  indexCache.delete(id);
  return d;
}

// فهرس خفيف للتقارير (يُعاد استخدامه ما دام الملف لم يتغير)
const indexCache = new Map();
async function listAll() {
  const files = (await fs.promises.readdir(REPORTS_DIR)).filter((f) => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    const id = f.slice(0, -5);
    try {
      const st = await fs.promises.stat(path.join(REPORTS_DIR, f));
      let c = indexCache.get(id);
      if (!c || c.m !== st.mtimeMs) {
        const raw = JSON.parse(await fs.promises.readFile(path.join(REPORTS_DIR, f), 'utf8'));
        const d = T.migrate(raw), w = WF.wf(raw);
        c = { m: st.mtimeMs, v: { id, title: d.title, template: d.template, templateName: raw.version === 2 ? T.byId(d.template).name : raw.type || '', employee: d.employee, department: d.department, date: d.date, createdAt: raw.createdAt || '', updatedAt: raw.updatedAt || raw.createdAt || '', owner: raw.owner || '', ownerName: raw.ownerName || '', workflow: w, _raw: { owner: raw.owner || '', workflow: raw.workflow || { status: 'draft' } } } };
        indexCache.set(id, c);
      }
      out.push(c.v);
    } catch (e) { /* تجاهل الملفات التالفة */ }
  }
  return out;
}
function summary(user, v) {
  const a = WF.access(user, v._raw);
  const { _raw, workflow, ...rest } = v;
  return Object.assign(rest, { status: workflow.status, statusLabel: WF.STATUS[workflow.status] || '', sharedWith: workflow.sharedWith || '', sharedWithName: workflow.sharedWithName || '', canEdit: a.edit, canDecide: a.decide });
}
async function listFor(user, scope) {
  const all = await listAll();
  let rows;
  if (scope === 'all') { if (user.role !== 'admin') return null; rows = all; }
  else if (scope === 'inbox') rows = all.filter((v) => v.workflow.status !== 'draft' && (v.workflow.sharedWith === user.username || (user.role === 'admin' && v.workflow.status === 'submitted')));
  else rows = all.filter((v) => v.owner === user.username);
  return rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map((v) => summary(user, v));
}
async function inboxCount(user) {
  if (user.role === 'employee') return 0;
  const all = await listAll();
  return all.filter((v) => v.workflow.status === 'submitted' && (user.role === 'admin' || v.workflow.sharedWith === user.username)).length;
}


/* ---------- العروض التقديمية ---------- */
const DECKS_DIR = path.join(__dirname, 'decks');
const D = require('./public/shared/deck.js');
const DECK_BLOCKS = new Set(D.BLOCK_TYPES.concat(['text', 'list']));
const sid = (v) => (/^[A-Za-z0-9_-]{1,40}$/.test(String(v || '')) ? String(v) : '');
function cleanDeck(d) {
  d = d || {}; const o = d.options || {};
  const sections = arr(d.sections, 120).filter((s) => DECK_BLOCKS.has(s && s.type)).map(cleanSection);
  const ids = new Set(sections.map((s) => s.id));
  const seen = new Set();
  const slides = arr(d.slides, 200).map((s) => {
    let id = sid(s && s.id) || T.uid(); if (seen.has(id)) id = T.uid(); seen.add(id);
    const layout = D.LAYOUTS[s && s.layout] ? s.layout : 'content';
    return { id, layout, bg: D.BGS[s && s.bg] ? s.bg : D.LAYOUTS[layout].bg, title: str(s && s.title, 300), subtitle: str(s && s.subtitle, 400), bullets: arr(s && s.bullets, 20).map((b) => str(b, 400)), notes: str(s && s.notes, 4000), blockId: ids.has(s && s.blockId) ? s.blockId : '' };
  });
  return {
    version: 1, kind: 'deck', id: d.id || null, template: D.TEMPLATES.some((t) => t.id === d.template) ? d.template : 'blank', sample: !!d.sample,
    title: str(d.title, 200), subtitle: str(d.subtitle, 300), presenter: str(d.presenter, 200), date: str(d.date, 30),
    ratio: D.RATIOS[d.ratio] ? d.ratio : '16:9', palette: T.PALETTES[d.palette] ? d.palette : 'hadiyah',
    options: { pageNumbers: o.pageNumbers !== false, footerText: str(o.footerText, 300), arabicDigits: !!o.arabicDigits },
    sections, slides,
  };
}
const deckFile = (id) => path.join(DECKS_DIR, id + '.json');
async function readDeck(id) { return JSON.parse(await fs.promises.readFile(deckFile(id), 'utf8')); }
async function writeDeck(id, content, meta) {
  const d = Object.assign(cleanDeck(content), meta, { id });
  const tmp = deckFile(id) + '.tmp';
  await fs.promises.writeFile(tmp, JSON.stringify(d, null, 2)); await fs.promises.rename(tmp, deckFile(id));
  return d;
}
const deckAccess = (user, d) => { const own = d.owner === user.username; return { read: own || user.role === 'admin', edit: own || user.role === 'admin' }; };
async function listDecks(user, scope) {
  if (scope === 'all' && user.role !== 'admin') return null;
  const out = [];
  for (const f of (await fs.promises.readdir(DECKS_DIR)).filter((x) => x.endsWith('.json'))) {
    try {
      const d = JSON.parse(await fs.promises.readFile(path.join(DECKS_DIR, f), 'utf8'));
      if (scope !== 'all' && d.owner !== user.username) continue;
      out.push({ id: f.slice(0, -5), title: d.title, subtitle: d.subtitle, slides: (d.slides || []).length, ratio: d.ratio, owner: d.owner, ownerName: d.ownerName, updatedAt: d.updatedAt, createdAt: d.createdAt, template: d.template });
    } catch (e) { /* تجاهل التالف */ }
  }
  return out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
let inlineAssets = null;
function standaloneHtml(deck, id) {
  const rd = (f) => fs.readFileSync(path.join(PUBLIC_DIR, f), 'utf8');
  const data = (u) => { try { const f = path.join(PUBLIC_DIR, path.normalize(u)); if (!f.startsWith(PUBLIC_DIR + path.sep)) return null; const ext = path.extname(f).toLowerCase(); return `data:${MIME[ext] || 'application/octet-stream'};base64,${fs.readFileSync(f).toString('base64')}`; } catch (e) { return null; } };
  if (!inlineAssets) {
    let css = ['css/tokens.css', 'css/report.css', 'css/deck.css'].map(rd).join('\n');
    css = css.replace(/url\(["']?(\/fonts\/[^"')]+)["']?\)/g, (m, u) => `url(${data(u) || u})`);
    inlineAssets = { css, js: rd('js/deck-present.js') };
  }
  let html = D.renderDeckPage(deck, { config: loadConfig(), id, inlineCss: inlineAssets.css, allowPrint: true });
  html = html.replace(/<script src="\/js\/deck-present\.js"><\/script>/, () => `<script>${inlineAssets.js}</script>`);
  html = html.replace(/(src|href)="(\/brand\/[^"]+)"/g, (m, a, u) => { const d = data(u); return d ? `${a}="${d}"` : m; });
  return html;
}


/* ---------- روابط المشاركة ---------- */
async function canShare(user, type, id) {
  try {
    if (!ID_RE.test(id)) return false;
    if (type === 'deck') return deckAccess(user, await readDeck(id)).edit;
    if (type === 'report') { const r = await readReport(id); return user.role === 'admin' || r.owner === user.username; }
  } catch (e) { /* غير موجود */ }
  return false;
}
const unlockFails = new Map();
const shareCookie = (tok) => 'rb_s_' + tok.slice(0, 12);
const msgPage = (res, code, title, msg) => send(res, code, `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${R.escRaw(title)}</title><link rel="stylesheet" href="/css/tokens.css"><body style="font-family:var(--font,Tahoma);display:grid;place-items:center;min-height:100vh;margin:0;background:#eef2f5"><div style="background:#fff;padding:32px 40px;border-radius:16px;max-width:460px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.12)"><img src="/brand/logo-icon.png" width="48" alt=""><h2>${R.escRaw(title)}</h2><p>${R.escRaw(msg)}</p></div></body></html>`, MIME['.html'], { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
const pwPage = (res, tok, err) => send(res, 200, `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>محتوى محمي</title><link rel="stylesheet" href="/css/tokens.css"><body style="font-family:var(--font,Tahoma);display:grid;place-items:center;min-height:100vh;margin:0;background:#eef2f5"><form method="post" action="/s/${tok}/unlock" style="background:#fff;padding:32px 40px;border-radius:16px;max-width:420px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,.12)"><img src="/brand/logo-icon.png" width="48" alt=""><h2>محتوى محمي بكلمة مرور</h2>${err ? `<p style="color:#b3382a">${R.escRaw(err)}</p>` : ''}<input type="password" name="password" autofocus required placeholder="كلمة المرور" aria-label="كلمة المرور" style="width:100%;padding:12px;border:1px solid #cfd8e0;border-radius:10px;font:inherit;box-sizing:border-box"><button style="margin-top:14px;width:100%;padding:12px;border:0;border-radius:10px;background:#007f73;color:#fff;font:inherit;cursor:pointer">فتح</button></form></body></html>`, MIME['.html'], { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });

async function handleShare(req, res, p) {
  const m = p.match(/^\/s\/([A-Za-z0-9_-]{10,64})(\/unlock)?$/);
  const sh = m && SH.get(m[1]);
  if (!sh || sh.revoked) return msgPage(res, 404, 'الرابط غير متاح', 'هذا الرابط غير صحيح أو تم إلغاؤه من صاحبه.');
  if (SH.state(sh) === 'expired') return msgPage(res, 410, 'انتهت صلاحية الرابط', 'انتهت مدة هذا الرابط. اطلب من صاحبه رابطاً جديداً.');
  const user = userOf(req), ip = clientIp(req);
  const privileged = user && (user.role === 'admin' || user.username === sh.owner);
  const who = user ? user.username : 'زائر';
  if (!privileged) {
    if (sh.mode === 'login' || sh.mode === 'users') {
      if (!user) return redirect(res, '/login.html?next=' + encodeURIComponent(req.url));
      if (sh.mode === 'users' && !sh.users.includes(user.username)) { SH.log(sh.token, { user: who, ip, ok: false, note: 'غير مصرّح' }); return page403(res, 'هذا الرابط مخصص لمستخدمين محددين ولست منهم.'); }
    } else if (sh.mode === 'password') {
      const ck = parseCookies(req)[shareCookie(sh.token)];
      if (!SH.unlockOk(sh, ck)) {
        if (m[2] && req.method === 'POST') {
          if (!sameOrigin(req)) return msgPage(res, 403, 'طلب مرفوض', 'مصدر الطلب غير موثوق.');
          const key = ip + '|' + sh.token, f = unlockFails.get(key) || { n: 0, until: 0 };
          if (f.until > Date.now()) return pwPage(res, sh.token, 'محاولات كثيرة. حاول بعد قليل.');
          const body = new URLSearchParams(await readBody(req, 4000));
          if (await SH.checkPw(body.get('password'), sh.passHash)) {
            unlockFails.delete(key); SH.log(sh.token, { user: who, ip, ok: true, note: 'فتح بكلمة المرور' });
            res.setHeader('Set-Cookie', `${shareCookie(sh.token)}=${SH.unlockToken(sh)}; HttpOnly; SameSite=Strict; Path=/s/${sh.token}; Max-Age=${8 * 3600}${cfgm.get().auth.secureCookie ? '; Secure' : ''}`);
            return redirect(res, '/s/' + sh.token);
          }
          f.n++; if (f.n >= 5) { f.until = Date.now() + 15 * 60000; f.n = 0; } unlockFails.set(key, f);
          SH.log(sh.token, { user: who, ip, ok: false, note: 'كلمة مرور خاطئة' });
          return pwPage(res, sh.token, 'كلمة المرور غير صحيحة');
        }
        return pwPage(res, sh.token, '');
      }
    }
  }
  if (m[2]) return redirect(res, '/s/' + sh.token);
  let html;
  try {
    if (sh.type === 'deck') html = D.renderDeckPage(await readDeck(sh.id), { config: loadConfig(), id: sh.id, allowPrint: !sh.noPrint });
    else { const d = await readReport(sh.id); html = R.renderPage(d, { config: loadConfig(), id: sh.id, workflow: d.workflow, shared: true, allowPrint: !sh.noPrint }); }
  } catch (e) { return msgPage(res, 404, 'المحتوى غير متاح', 'تم حذف المحتوى المشارَك.'); }
  SH.log(sh.token, { user: who, ip, ok: true, note: 'عرض' }); SH.view(sh);
  return send(res, 200, html, MIME['.html'], { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
}

/* ---------- الجلسات والمصادقة ---------- */
const parseCookies = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => { const i = c.indexOf('='); return i < 0 ? [] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())]; }).filter((x) => x.length));
const tokenOf = (req) => parseCookies(req).rb_sid || '';
const userOf = (req) => auth.sessionUser(tokenOf(req));
const clientIp = (req) => (cfgm.get().auth.trustProxy ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || '';
const cookie = (token, maxAge) => `rb_sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${cfgm.get().auth.secureCookie ? '; Secure' : ''}`;
const sameOrigin = (req) => { const o = req.headers.origin; if (!o) return true; try { return new URL(o).host === req.headers.host; } catch (e) { return false; } };
const deny = (msg) => Object.assign(new Error(msg), { status: 403 });
const redirect = (res, to) => { res.writeHead(302, { Location: to, 'Cache-Control': 'no-store' }); res.end(); };
const page403 = (res, msg) => send(res, 403, `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>غير مصرّح</title><link rel="stylesheet" href="/css/tokens.css"><body style="font-family:var(--font);display:grid;place-items:center;min-height:100vh;margin:0;background:#f3f5f8"><div style="text-align:center;background:#fff;padding:40px 48px;border-radius:16px;box-shadow:0 4px 24px #0002"><h1 style="margin:0 0 8px">غير مصرّح</h1><p style="color:#647385">${msg}</p><p><a href="/">العودة للرئيسية</a></p></div></body></html>`, MIME['.html']);
const PROTECTED_PAGES = new Set(['/', '/index.html', '/list.html', '/admin.html', '/decks.html', '/deck.html', '/dashboard.html']);

async function handleApi(req, res, url, p) {
  const method = req.method;
  if (method !== 'GET' && !sameOrigin(req)) return json(res, 403, { error: 'طلب مرفوض' });

  // --- عام (بدون جلسة) ---
  if (p === '/api/auth-info' && method === 'GET') { const c = cfgm.get(); return json(res, 200, { mode: c.auth.mode, domain: c.auth.domain || '', orgName: c.orgName || '' }); }
  if (p === '/api/login' && method === 'POST') {
    const body = JSON.parse(await readBody(req, 20000));
    const r = await auth.login(body.username, body.password, clientIp(req));
    if (!r.ok) return json(res, r.code === 'locked' ? 429 : r.code === 'unavailable' ? 503 : 401, { error: r.error });
    res.setHeader('Set-Cookie', cookie(r.token, 24 * 3600));
    return json(res, 200, { user: r.user });
  }
  if (p === '/api/logout' && method === 'POST') { auth.destroySession(tokenOf(req)); res.setHeader('Set-Cookie', cookie('', 0)); return json(res, 200, { ok: true }); }

  const user = userOf(req);
  if (!user) return json(res, 401, { error: 'يلزم تسجيل الدخول' });

  if (p === '/api/me' && method === 'GET') return json(res, 200, Object.assign({}, user, { inbox: await inboxCount(user), canChangePassword: user.source === 'local' }));
  if (p === '/api/me/password' && method === 'POST') {
    const b = JSON.parse(await readBody(req, 20000));
    try { await auth.changeOwnPassword(user.username, b.current, b.next); } catch (e) { return json(res, 400, { error: e.message }); }
    res.setHeader('Set-Cookie', cookie('', 0)); store.audit({ action: 'password-change', user: user.username }); return json(res, 200, { ok: true });
  }
  if (p === '/api/config' && method === 'GET') return json(res, 200, loadConfig());
  if (p === '/api/managers' && method === 'GET') {
    const ap = auth.approversOf(user);
    if (ap.restricted) return json(res, 200, { restricted: true, list: ap.list.map((m, i) => ({ username: m.username, name: m.name, department: m.department, isMine: i === 0 })) });
    const mine = (auth.find(user.username) || {}).managerUsername || '';
    return json(res, 200, { restricted: false, list: auth.listManagers().filter((m) => m.username !== user.username).map((m) => ({ username: m.username, name: m.name, department: m.department, isMine: m.username === mine })) });
  }

  // --- إدارة النظام ---
  if (p.startsWith('/api/admin/')) {
    if (user.role !== 'admin') return json(res, 403, { error: 'للمسؤول فقط' });
    if (p === '/api/admin/users' && method === 'GET') return json(res, 200, auth.listUsers());
    if (p === '/api/admin/settings' && method === 'GET') return json(res, 200, auth.getSettings());
    if (p === '/api/admin/settings' && method === 'PUT') { try { const b = JSON.parse(await readBody(req, 20000)); const st = auth.setSettings(b); store.audit({ action: 'settings-update', by: user.username, defaultTemplates: st.defaultTemplates }); return json(res, 200, st); } catch (e) { return json(res, 400, { error: e.message }); } }
    if (p === '/api/admin/users/auto-approvers' && method === 'POST') { const n = auth.autoApprovers(); store.audit({ action: 'approvers-auto', by: user.username, count: n }); return json(res, 200, { count: n }); }
    if (p === '/api/admin/audit' && method === 'GET') return json(res, 200, store.readAudit(Math.min(500, parseInt(url.searchParams.get('n'), 10) || 150)));
    try {
      if (p === '/api/admin/users' && method === 'POST') {
        const b = JSON.parse(await readBody(req, 20000));
        const u = b.source === 'ad' ? auth.addDomainUser(b) : await auth.createLocal(b);
        store.audit({ action: 'user-create', by: user.username, user: u.username, role: u.role, source: u.source }); return json(res, 201, u);
      }
      const m = p.match(/^\/api\/admin\/users\/([a-z0-9._-]+)(\/password)?$/);
      if (m) {
        if (m[2] && method === 'POST') { const b = JSON.parse(await readBody(req, 20000)); await auth.setPassword(m[1], b.password); store.audit({ action: 'password-reset', by: user.username, user: m[1] }); return json(res, 200, { ok: true }); }
        if (!m[2] && method === 'PATCH') { const b = JSON.parse(await readBody(req, 20000)); const u = auth.updateUser(m[1], b, user.username); store.audit({ action: 'user-update', by: user.username, user: m[1], patch: { role: b.role, disabled: b.disabled, allowedTemplates: b.allowedTemplates, approvers: b.approvers } }); return json(res, 200, u); }
        if (!m[2] && method === 'DELETE') { auth.deleteUser(m[1], user.username); store.audit({ action: 'user-delete', by: user.username, user: m[1] }); return json(res, 200, { ok: true }); }
      }
    } catch (e) { return json(res, 400, { error: e.message }); }
    return json(res, 404, { error: 'غير موجود' });
  }

  // --- لوحة الرئيسية ---
  if (p === '/api/dashboard' && method === 'GET') {
    const mine = await listFor(user, 'mine'), decks = (await listDecks(user, 'mine')) || [];
    const inbox = user.role === 'employee' ? [] : await listFor(user, 'inbox');
    const pick = (r) => ({ id: r.id, title: r.title, status: r.status, statusLabel: r.statusLabel, updatedAt: r.updatedAt, templateName: r.templateName });
    const titleOf = new Map(mine.map((r) => ['report:' + r.id, r.title]).concat(decks.map((d) => ['deck:' + d.id, d.title])));
    const shares = SH.listByOwner(user.username).map((s) => Object.assign(SH.pub(s), { title: titleOf.get(s.type + ':' + s.id) || '' }));
    const by = (st) => mine.filter((r) => r.status === st);
    const out = {
      counts: { reports: mine.length, drafts: by('draft').length, submitted: by('submitted').length, approved: by('approved').length, returned: by('returned').length, decks: decks.length, shares: shares.filter((s) => s.state === 'active').length, inbox: inbox.length, reportTemplates: T.TEMPLATES.length, deckTemplates: D.TEMPLATES.length },
      recentReports: mine.slice(0, 5).map(pick), drafts: by('draft').slice(0, 5).map(pick), returned: by('returned').slice(0, 5).map(pick), inbox: inbox.slice(0, 6).map((r) => Object.assign(pick(r), { ownerName: r.ownerName })),
      recentDecks: decks.slice(0, 5).map((d) => ({ id: d.id, title: d.title, slides: d.slides, updatedAt: d.updatedAt })), shares: shares.filter((s) => s.state === 'active').slice(0, 5),
    };
    if (user.role === 'admin') { out.admin = { allReports: (await listAll()).length, allDecks: ((await listDecks(user, 'all')) || []).length, users: auth.listUsers().length }; }
    return json(res, 200, out);
  }

  // --- روابط المشاركة ---
  if (p === '/api/users-lite' && method === 'GET') return json(res, 200, auth.listUsers().filter((u) => !u.disabled && u.username !== user.username).map((u) => ({ username: u.username, name: u.name, department: u.department || '' })));
  if (p === '/api/shares' && method === 'GET') {
    const type = url.searchParams.get('type'), rid = url.searchParams.get('id') || '';
    if (!(await canShare(user, type, rid))) return json(res, 403, { error: 'غير مصرّح لك' });
    return json(res, 200, SH.listFor(type, rid).map(SH.pub));
  }
  if (p === '/api/shares' && method === 'POST') {
    const b = JSON.parse(await readBody(req, 20000));
    if (!(await canShare(user, b.type, String(b.id || '')))) return json(res, 403, { error: 'غير مصرّح لك بمشاركة هذا العنصر' });
    try {
      const sh = await SH.create(user, b);
      store.audit({ action: 'share-create', by: user.username, type: sh.type, id: sh.id, mode: sh.mode });
      return json(res, 201, SH.pub(sh));
    } catch (e) { return json(res, 400, { error: e.message }); }
  }
  const shm = p.match(/^\/api\/shares\/([A-Za-z0-9_-]{10,64})(?:\/(revoke|log))?$/);
  if (shm) {
    const sh = SH.get(shm[1]);
    if (!sh) return json(res, 404, { error: 'غير موجود' });
    if (!(await canShare(user, sh.type, sh.id))) return json(res, 403, { error: 'غير مصرّح لك' });
    if (shm[2] === 'log' && method === 'GET') return json(res, 200, SH.readLog(sh.token));
    if (shm[2] === 'revoke' && method === 'POST') { SH.revoke(sh.token); store.audit({ action: 'share-revoke', by: user.username, type: sh.type, id: sh.id }); return json(res, 200, SH.pub(SH.get(sh.token))); }
    if (!shm[2] && method === 'DELETE') { SH.remove(sh.token); store.audit({ action: 'share-delete', by: user.username, type: sh.type, id: sh.id }); return json(res, 200, { ok: true }); }
    return json(res, 405, { error: 'غير مدعوم' });
  }

  // --- العروض التقديمية ---
  if (p === '/api/decks' && method === 'GET') {
    const rows = await listDecks(user, url.searchParams.get('scope') || 'mine');
    return rows ? json(res, 200, rows) : json(res, 403, { error: 'للمسؤول فقط' });
  }
  if (p === '/api/decks' && method === 'POST') {
    const data = JSON.parse(await readBody(req));
    if (!str(data.title).trim()) return json(res, 400, { error: 'عنوان العرض مطلوب' });
    const id = Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex'), now = new Date().toISOString();
    await writeDeck(id, data, { owner: user.username, ownerName: user.name, createdAt: now, updatedAt: now });
    store.audit({ action: 'deck-create', by: user.username, id });
    return json(res, 201, { id, url: '/decks/' + id + '.html' });
  }
  const dm = p.match(/^\/api\/decks\/([a-z0-9-]+)(?:\/(export\.html))?$/);
  if (dm) {
    if (!ID_RE.test(dm[1])) return json(res, 404, { error: 'غير موجود' });
    const did = dm[1], dk = await readDeck(did), dacc = deckAccess(user, dk);
    if (!dacc.read) return json(res, 403, { error: 'غير مصرّح لك بهذا العرض' });
    if (dm[2] && method === 'GET') {
      store.audit({ action: 'deck-export-html', by: user.username, id: did });
      return send(res, 200, standaloneHtml(dk, did), MIME['.html'], { 'Content-Disposition': `attachment; filename="deck-${did}.html"`, 'Cache-Control': 'no-store' });
    }
    if (method === 'GET') return json(res, 200, Object.assign({}, dk, { access: dacc }));
    if (method === 'PUT') {
      if (!dacc.edit) return json(res, 403, { error: 'لا يمكنك تعديل هذا العرض' });
      const data = JSON.parse(await readBody(req));
      if (!str(data.title).trim()) return json(res, 400, { error: 'عنوان العرض مطلوب' });
      await writeDeck(did, data, { owner: dk.owner, ownerName: dk.ownerName, createdAt: dk.createdAt, updatedAt: new Date().toISOString() });
      store.audit({ action: 'deck-update', by: user.username, id: did });
      return json(res, 200, { id: did, url: '/decks/' + did + '.html' });
    }
    if (method === 'DELETE') {
      if (!dacc.edit) return json(res, 403, { error: 'لا يمكنك حذف هذا العرض' });
      await fs.promises.unlink(deckFile(did)); SH.removeFor('deck', did); store.audit({ action: 'deck-delete', by: user.username, id: did });
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: 'غير مدعوم' });
  }

  // --- التقارير ---
  if (p === '/api/reports' && method === 'GET') {
    const scope = url.searchParams.get('scope') || 'mine';
    const rows = await listFor(user, scope);
    return rows ? json(res, 200, rows) : json(res, 403, { error: 'للمسؤول فقط' });
  }
  if (p === '/api/reports' && method === 'POST') {
    const data = JSON.parse(await readBody(req));
    if (!str(data.title).trim()) return json(res, 400, { error: 'عنوان التقرير مطلوب' });
    if (!auth.canUseTemplate(user, clean(data).template)) return json(res, 403, { error: 'نوع هذا التقرير غير مسموح لحسابك. تواصل مع مسؤول النظام.' });
    const id = Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex'), now = new Date().toISOString();
    await writeReport(id, data, { owner: user.username, ownerName: user.name, workflow: { status: 'draft' }, history: [{ at: now, by: user.username, byName: user.name, action: 'create', note: '' }], createdAt: now, updatedAt: now });
    store.audit({ action: 'report-create', by: user.username, id });
    return json(res, 201, { id, url: '/reports/' + id + '.html' });
  }
  const m = p.match(/^\/api\/reports\/([a-z0-9-]+)(?:\/(share|withdraw|approve|return|reopen|owner))?$/);
  if (!m || !ID_RE.test(m[1])) return json(res, 404, { error: 'غير موجود' });
  const id = m[1], act = m[2];
  const rep = await readReport(id);                       // يرمي ENOENT → 404
  const acc = WF.access(user, rep);
  if (!acc.read) return json(res, 403, { error: 'غير مصرّح لك بهذا التقرير' });

  if (!act && method === 'GET') return json(res, 200, Object.assign({}, rep, { access: acc, statusLabel: WF.STATUS[WF.wf(rep).status] }));
  if (!act && method === 'PUT') {
    if (!acc.edit) return json(res, 403, { error: WF.wf(rep).status === 'approved' ? 'التقرير معتمد ولا يمكن تعديله' : WF.wf(rep).status === 'submitted' ? 'التقرير بانتظار الاعتماد. اسحبه أولاً لتعديله' : 'غير مصرّح لك بالتعديل' });
    const data = JSON.parse(await readBody(req));
    if (!str(data.title).trim()) return json(res, 400, { error: 'عنوان التقرير مطلوب' });
    const nt = clean(data).template;
    if (nt !== rep.template && !auth.canUseTemplate(user, nt)) return json(res, 403, { error: 'نوع القالب المختار غير مسموح لحسابك' });
    await writeReport(id, data, { owner: rep.owner, ownerName: rep.ownerName, workflow: rep.workflow, history: rep.history, createdAt: rep.createdAt, updatedAt: new Date().toISOString() });
    store.audit({ action: 'report-update', by: user.username, id });
    return json(res, 200, { id, url: '/reports/' + id + '.html' });
  }
  if (act && method === 'POST') {
    const body = JSON.parse((await readBody(req, 20000)) || '{}');
    try {
      if (act === 'share') {
        if (!acc.share) throw deny('لا يمكن إرسال التقرير في حالته الحالية');
        if (!rep.title.trim()) throw new Error('أدخل عنوان التقرير أولاً');
        const mgr = auth.find(body.manager);
        if (!mgr || mgr.disabled || auth.RANK[mgr.role] < 1) throw new Error('اختر مديراً صحيحاً');
        if (mgr.username === user.username) throw new Error('لا يمكنك إرسال التقرير لنفسك');
        const ap = auth.approversOf(user);
        if (ap.restricted && !ap.list.some((m) => m.username === mgr.username)) throw deny(ap.list.length ? 'هذا المدير ليس معتمِدك. المعتمِد المحدد لك: ' + ap.list.map((m) => m.name).join('، ') : 'المعتمِد المحدد لك غير متاح حالياً. تواصل مع مسؤول النظام.');
        WF.actions.share(rep, user, { manager: mgr, note: body.note });
      } else if (act === 'withdraw') { if (!acc.withdraw) throw deny('غير متاح'); WF.actions.withdraw(rep, user); }
      else if (act === 'approve') { if (!acc.decide) throw deny('غير مصرّح لك بالاعتماد'); WF.actions.approve(rep, user, body); }
      else if (act === 'return') { if (!acc.decide) throw deny('غير مصرّح لك بالإعادة'); WF.actions.return(rep, user, body); }
      else if (act === 'reopen') { if (!acc.reopen) throw deny('غير متاح'); WF.actions.reopen(rep, user); }
      else if (act === 'owner') {
        if (!acc.reassign) throw deny('للمسؤول فقط');
        const nu = auth.find(body.username); if (!nu) throw new Error('المستخدم غير موجود');
        rep.owner = nu.username; rep.ownerName = nu.name; WF.push(rep, user, 'reassign', 'إلى ' + nu.name);
      }
    } catch (e) { return json(res, e.status || 400, { error: e.message }); }
    await writeReport(id, rep, { owner: rep.owner, ownerName: rep.ownerName, workflow: rep.workflow, history: rep.history, createdAt: rep.createdAt, updatedAt: new Date().toISOString() });
    store.audit({ action: 'report-' + act, by: user.username, id, to: rep.workflow && rep.workflow.sharedWith });
    return json(res, 200, { ok: true, workflow: rep.workflow });
  }
  return json(res, 405, { error: 'غير مدعوم' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  try {
    if (p.startsWith('/api/')) return await handleApi(req, res, url, p);

    // صفحة التقرير النهائية: تتطلب تسجيل دخول وصلاحية قراءة
    let m = p.match(/^\/reports\/([a-z0-9-]+)\.html$/);
    if (m && req.method === 'GET') {
      if (!ID_RE.test(m[1])) return send(res, 404, 'غير موجود');
      const user = userOf(req);
      if (!user) return redirect(res, '/login.html?next=' + encodeURIComponent(req.url));
      const d = await readReport(m[1]);
      if (!WF.access(user, d).read) return page403(res, 'هذا التقرير ليس من تقاريرك ولم يُشارَك معك.');
      return send(res, 200, R.renderPage(d, { config: loadConfig(), id: m[1], workflow: d.workflow }), MIME['.html'], { 'Cache-Control': 'no-store' });
    }

    if (p.startsWith('/s/') && (req.method === 'GET' || req.method === 'POST')) return await handleShare(req, res, p);

    let dv = p.match(/^\/decks\/([a-z0-9-]+)\.html$/);
    if (dv && req.method === 'GET') {
      if (!ID_RE.test(dv[1])) return send(res, 404, 'غير موجود');
      const user = userOf(req);
      if (!user) return redirect(res, '/login.html?next=' + encodeURIComponent(req.url));
      const d = await readDeck(dv[1]);
      if (!deckAccess(user, d).read) return page403(res, 'هذا العرض ليس من عروضك.');
      return send(res, 200, D.renderDeckPage(d, { config: loadConfig(), id: dv[1], actions: `<a class="btn" href="/deck.html?id=${dv[1]}">تعديل</a><a class="btn" href="/api/decks/${dv[1]}/export.html">تنزيل صفحة ويب</a>` }), MIME['.html'], { 'Cache-Control': 'no-store' });
    }

    if (req.method === 'GET' && PROTECTED_PAGES.has(p)) {
      const user = userOf(req);
      if (!user) return redirect(res, '/login.html?next=' + encodeURIComponent(req.url));
      if (p === '/admin.html' && user.role !== 'admin') return page403(res, 'هذه الصفحة للمسؤول فقط.');
    }
    if (req.method === 'GET') return serveStatic(res, p);
    send(res, 405, 'Method Not Allowed');
  } catch (e) {
    if (e && e.code === 'ENOENT') return json(res, 404, { error: 'غير موجود' });
    json(res, 400, { error: 'طلب غير صالح' });
  }
});

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.mkdirSync(DECKS_DIR, { recursive: true });
auth.bootstrapAdmin().then((pw) => {
  if (pw) {
    const line = '='.repeat(64);
    console.log(`\n${line}\n  أول تشغيل: أُنشئ حساب مسؤول محلي احتياطي\n  اسم المستخدم: admin\n  كلمة المرور : ${pw}\n  سجّل الدخول وغيّر كلمة المرور فوراً (أو: node tools/users.js passwd admin)\n${line}\n`);
  }
  server.listen(PORT, HOST, () => console.log(`http://${HOST}:${PORT}`));
});
