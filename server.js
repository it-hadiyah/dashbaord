'use strict';
// خادم بدون مكتبات خارجية وبدون قاعدة بيانات: كل تقرير يُحفظ كملف JSON داخل مجلد reports،
// وصفحة العرض تُولَّد منه عند الطلب (فتنعكس تحديثات التصميم والكليشة على التقارير القديمة).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const T = require('./public/shared/templates.js');
const R = require('./public/shared/render.js');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const REPORTS_DIR = path.join(__dirname, 'reports');
const MAX_BODY = 24 * 1024 * 1024;
const MAX_IMAGE = 3 * 1024 * 1024;
const ID_RE = /^[a-z0-9-]{3,40}$/;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

const loadConfig = () => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch (e) { return {}; } };

/* ---------- التحقق من البيانات وتنظيفها ---------- */
const str = (v, max = 5000) => String(v == null ? '' : v).slice(0, max);
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

function cleanContent(type, c) {
  c = c == null ? {} : c;
  switch (type) {
    case 'text': return R.sanitize(str(c, 60000));
    case 'list': return { ordered: !!c.ordered, items: arr(c.items, 300).map((i) => str(i, 600)) };
    case 'table': return {
      zebra: c.zebra !== false,
      headers: arr(c.headers, 12).map((h) => str(h, 200)),
      rows: arr(c.rows, 500).map((r) => arr(r, 12).map((x) => str(x, 1000))),
    };
    case 'kpi': return { style: c.style === 'highlights' ? 'highlights' : 'cards', items: arr(c.items, 24).map((k) => ({ label: str(k && k.label, 200), value: str(k && k.value, 100), trend: str(k && k.trend, 30) })) };
    case 'chart': return {
      kind: ['bar', 'line', 'area', 'donut', 'hbar'].includes(c.kind) ? c.kind : 'bar', unit: str(c.unit, 20),
      data: arr(c.data, 60).map((d) => ({ label: str(d && d.label, 200), value: str(d && d.value, 50) })),
    };
    case 'progress': return { items: arr(c.items, 30).map((i) => ({ label: str(i && i.label, 200), value: str(i && i.value, 20) })) };
    case 'timeline': return { items: arr(c.items, 60).map((i) => ({ date: str(i && i.date, 100), title: str(i && i.title, 300), desc: str(i && i.desc, 1000), status: ['done', 'active', 'todo'].includes(i && i.status) ? i.status : 'todo' })) };
    case 'image': {
      const src = str(c.src, MAX_IMAGE * 1.4);
      return { src: R.SAFE_IMG.test(src) && src.length <= MAX_IMAGE * 1.4 ? src : '', caption: str(c.caption, 300), fit: c.fit === 'cover' ? 'cover' : 'contain', height: Math.max(60, Math.min(600, parseInt(c.height, 10) || 220)) };
    }
    case 'callout': return { tone: ['info', 'success', 'warn'].includes(c.tone) ? c.tone : 'info', text: str(c.text, 3000) };
    default: return {};
  }
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
      margins: ['narrow', 'normal', 'wide'].includes(o.margins) ? o.margins : 'normal', footerText: str(o.footerText, 300), arabicDigits: !!o.arabicDigits,
    },
    sections: arr(d.sections, 80).map((s) => {
      const type = T.TYPES.includes(s && s.type) ? s.type : 'text';
      return { id: /^[A-Za-z0-9_-]{1,40}$/.test(s && s.id) ? s.id : T.uid(), type, title: str(s && s.title, 200), visible: !(s && s.visible === false), width: s && s.width === 'half' ? 'half' : 'full', hint: str(s && s.hint, 300), content: cleanContent(type, s && s.content) };
    }),
  };
}

/* ---------- أدوات HTTP ---------- */
function send(res, code, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(code, Object.assign({ 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' }, extra));
  res.end(body);
}
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), MIME['.json'], { 'Cache-Control': 'no-store' });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); return; } chunks.push(c); });
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
async function readReport(id) {
  const raw = JSON.parse(await fs.promises.readFile(fileOf(id), 'utf8'));
  const d = T.migrate(raw);
  d.id = id; d.createdAt = raw.createdAt; d.updatedAt = raw.updatedAt;
  return d;
}
async function saveReport(id, data) {
  const d = clean(data);
  d.id = id;
  const now = new Date().toISOString();
  let createdAt = now;
  try { createdAt = JSON.parse(await fs.promises.readFile(fileOf(id), 'utf8')).createdAt || now; } catch (e) { /* جديد */ }
  d.createdAt = createdAt; d.updatedAt = now;
  const tmp = fileOf(id) + '.tmp';
  await fs.promises.writeFile(tmp, JSON.stringify(d, null, 2));
  await fs.promises.rename(tmp, fileOf(id));
  return d;
}
async function listReports() {
  const files = (await fs.promises.readdir(REPORTS_DIR)).filter((f) => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(await fs.promises.readFile(path.join(REPORTS_DIR, f), 'utf8'));
      const d = T.migrate(raw);
      out.push({ id: f.slice(0, -5), title: d.title, template: d.template, templateName: raw.version === 2 ? T.byId(d.template).name : raw.type || '', employee: d.employee, department: d.department, date: d.date, createdAt: raw.createdAt || '', updatedAt: raw.updatedAt || raw.createdAt || '' });
    } catch (e) { /* تجاهل الملفات التالفة */ }
  }
  return out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  try {
    if (p === '/api/config' && req.method === 'GET') return json(res, 200, loadConfig());
    if (p === '/api/reports' && req.method === 'GET') return json(res, 200, await listReports());
    if (p === '/api/reports' && req.method === 'POST') {
      const data = JSON.parse(await readBody(req));
      if (!str(data.title).trim()) return json(res, 400, { error: 'عنوان التقرير مطلوب' });
      const id = Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
      await saveReport(id, data);
      return json(res, 201, { id, url: '/reports/' + id + '.html' });
    }
    let m = p.match(/^\/api\/reports\/([a-z0-9-]+)$/);
    if (m && ID_RE.test(m[1])) {
      if (req.method === 'GET') return json(res, 200, await readReport(m[1]));
      if (req.method === 'PUT') {
        await readReport(m[1]); // يتأكد من وجوده
        const data = JSON.parse(await readBody(req));
        if (!str(data.title).trim()) return json(res, 400, { error: 'عنوان التقرير مطلوب' });
        await saveReport(m[1], data);
        return json(res, 200, { id: m[1], url: '/reports/' + m[1] + '.html' });
      }
    }
    m = p.match(/^\/reports\/([a-z0-9-]+)\.html$/);
    if (m && req.method === 'GET') {
      if (!ID_RE.test(m[1])) return send(res, 404, 'غير موجود');
      const d = await readReport(m[1]);
      return send(res, 200, R.renderPage(d, { config: loadConfig(), id: m[1] }), MIME['.html'], { 'Cache-Control': 'no-store' });
    }
    if (req.method === 'GET') return serveStatic(res, p);
    send(res, 405, 'Method Not Allowed');
  } catch (e) {
    if (e && e.code === 'ENOENT') return json(res, 404, { error: 'غير موجود' });
    json(res, 400, { error: 'طلب غير صالح' });
  }
});

fs.mkdirSync(REPORTS_DIR, { recursive: true });
server.listen(PORT, HOST, () => console.log(`http://${HOST}:${PORT}`));
