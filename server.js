'use strict';
// خادم بدون أي مكتبات خارجية وبدون قاعدة بيانات:
// كل تقرير يُحفظ كملفين داخل مجلد reports: صفحة HTML للعرض وملف JSON ببياناته
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const REPORTS_DIR = path.join(__dirname, 'reports');
const MAX_BODY = 2 * 1024 * 1024;

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const multiline = (v) => esc(v).replace(/\r?\n/g, '<br>');

function renderSection(s) {
  const title = s.title ? `<h2>${esc(s.title)}</h2>` : '';
  switch (s.type) {
    case 'text':
      return `<section>${title}<p>${multiline(s.content)}</p></section>`;
    case 'list': {
      const items = (Array.isArray(s.content) ? s.content : []).filter(Boolean);
      return `<section>${title}<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`;
    }
    case 'kpi': {
      const items = (Array.isArray(s.content) ? s.content : []).filter((k) => k && (k.label || k.value));
      return `<section>${title}<div class="kpis">${items.map((k) => `<div><b>${esc(k.value)}</b><span>${esc(k.label)}</span></div>`).join('')}</div></section>`;
    }
    case 'table': {
      const c = s.content || {};
      const head = (c.headers || []).map((h) => `<th>${esc(h)}</th>`).join('');
      const body = (c.rows || []).map((r) => `<tr>${r.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('');
      return `<section>${title}<div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></section>`;
    }
    default:
      return '';
  }
}

function renderReport(d, id) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.title)}</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<main class="report">
  <header>
    <small>${esc(d.type)}</small>
    <h1>${esc(d.title)}</h1>
    <p class="meta">${esc(d.employee)}${d.department ? ' · ' + esc(d.department) : ''}${d.date ? ' · ' + esc(d.date) : ''} · رقم التقرير: ${esc(id)}</p>
  </header>
  ${(d.sections || []).map(renderSection).join('\n  ')}
  <footer class="noprint"><a href="/">تقرير جديد</a> · <a href="/list.html">كل التقارير</a> · <a href="javascript:window.print()">طباعة</a></footer>
</main>
</body>
</html>`;
}

// تنظيف البيانات القادمة من المتصفح قبل حفظها
const str = (v, max = 5000) => String(v ?? '').slice(0, max);
function clean(d) {
  const sections = (Array.isArray(d.sections) ? d.sections : []).slice(0, 50).map((s) => {
    const type = ['text', 'list', 'table', 'kpi'].includes(s.type) ? s.type : 'text';
    let content;
    if (type === 'text') content = str(s.content, 20000);
    else if (type === 'list') content = (Array.isArray(s.content) ? s.content : []).slice(0, 200).map((i) => str(i, 500));
    else if (type === 'kpi') content = (Array.isArray(s.content) ? s.content : []).slice(0, 50).map((k) => ({ label: str(k && k.label, 200), value: str(k && k.value, 100) }));
    else {
      const c = s.content || {};
      content = {
        headers: (Array.isArray(c.headers) ? c.headers : []).slice(0, 20).map((h) => str(h, 200)),
        rows: (Array.isArray(c.rows) ? c.rows : []).slice(0, 500).map((r) => (Array.isArray(r) ? r : []).slice(0, 20).map((x) => str(x, 1000))),
      };
    }
    return { type, title: str(s.title, 200), content };
  });
  return { title: str(d.title, 200), type: str(d.type, 100), employee: str(d.employee, 200), department: str(d.department, 200), date: str(d.date, 30), sections };
}

function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), 'application/json; charset=utf-8');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveFile(res, dir, name) {
  const file = path.join(dir, path.basename(name));
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'غير موجود');
    send(res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream');
  });
}

async function listReports() {
  const files = (await fs.promises.readdir(REPORTS_DIR)).filter((f) => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try {
      const d = JSON.parse(await fs.promises.readFile(path.join(REPORTS_DIR, f), 'utf8'));
      out.push({ id: f.slice(0, -5), title: d.title, type: d.type, employee: d.employee, department: d.department, date: d.date, createdAt: d.createdAt });
    } catch (e) { /* تجاهل الملفات التالفة */ }
  }
  return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'POST' && url.pathname === '/api/reports') {
      const data = clean(JSON.parse(await readBody(req)));
      if (!data.title || !data.employee) return json(res, 400, { error: 'عنوان التقرير واسم الموظف مطلوبان' });
      const id = Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
      data.createdAt = new Date().toISOString();
      await fs.promises.writeFile(path.join(REPORTS_DIR, id + '.json'), JSON.stringify(data, null, 2));
      await fs.promises.writeFile(path.join(REPORTS_DIR, id + '.html'), renderReport(data, id));
      return json(res, 201, { url: '/reports/' + id + '.html' });
    }
    if (req.method === 'GET' && url.pathname === '/api/reports') return json(res, 200, await listReports());
    if (req.method === 'GET' && url.pathname.startsWith('/reports/')) {
      const name = url.pathname.slice('/reports/'.length);
      if (!/^[a-z0-9-]+\.html$/.test(name)) return send(res, 404, 'غير موجود');
      return serveFile(res, REPORTS_DIR, name);
    }
    if (req.method === 'GET') return serveFile(res, PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
    send(res, 405, 'Method Not Allowed');
  } catch (e) {
    json(res, 400, { error: 'طلب غير صالح' });
  }
});

fs.mkdirSync(REPORTS_DIR, { recursive: true });
server.listen(PORT, HOST, () => console.log(`http://${HOST}:${PORT}`));
