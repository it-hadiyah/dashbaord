'use strict';
// خادم بدون أي مكتبات خارجية وبدون قاعدة بيانات: كل تقرير يُحفظ كملف HTML داخل مجلد reports
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const REPORTS_DIR = path.join(__dirname, 'reports');
const MAX_BODY = 1024 * 1024;

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const multiline = (v) => esc(v).replace(/\r?\n/g, '<br>');

function renderReport(d, id) {
  const tasks = (d.tasks || []).filter((t) => t && t.name);
  const rows = tasks.map((t) => `<tr><td>${esc(t.name)}</td><td>${esc(t.owner)}</td><td>${esc(t.status)}</td><td>${esc(t.progress)}%</td></tr>`).join('');
  const avg = tasks.length ? Math.round(tasks.reduce((s, t) => s + (Number(t.progress) || 0), 0) / tasks.length) : Number(d.progress) || 0;
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>تقرير: ${esc(d.projectName)}</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<main class="report">
  <header>
    <h1>${esc(d.projectName)}</h1>
    <p class="meta">رقم التقرير: ${esc(id)} · أعدّه: ${esc(d.employee)} · ${esc(new Date().toLocaleString('ar-SA'))}</p>
  </header>
  <section class="grid">
    <div><b>القسم</b><span>${esc(d.department)}</span></div>
    <div><b>مدير المشروع</b><span>${esc(d.manager)}</span></div>
    <div><b>تاريخ البداية</b><span>${esc(d.startDate)}</span></div>
    <div><b>تاريخ النهاية</b><span>${esc(d.endDate)}</span></div>
    <div><b>الحالة</b><span>${esc(d.status)}</span></div>
    <div><b>الميزانية</b><span>${esc(d.budget)}</span></div>
  </section>
  <section><h2>نسبة الإنجاز</h2><div class="bar"><div style="width:${Math.min(100, avg)}%">${avg}%</div></div></section>
  <section><h2>ملخص المشروع</h2><p>${multiline(d.summary)}</p></section>
  ${rows ? `<section><h2>المهام</h2><table><thead><tr><th>المهمة</th><th>المسؤول</th><th>الحالة</th><th>الإنجاز</th></tr></thead><tbody>${rows}</tbody></table></section>` : ''}
  ${d.risks ? `<section><h2>المخاطر والعوائق</h2><p>${multiline(d.risks)}</p></section>` : ''}
  ${d.notes ? `<section><h2>ملاحظات</h2><p>${multiline(d.notes)}</p></section>` : ''}
  <footer class="noprint"><a href="/">تقرير جديد</a> · <a href="javascript:window.print()">طباعة</a></footer>
</main>
</body>
</html>`;
}

function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'POST' && url.pathname === '/api/reports') {
      const data = JSON.parse(await readBody(req));
      if (!data.projectName || !data.employee || !data.summary) return send(res, 400, JSON.stringify({ error: 'الحقول المطلوبة ناقصة' }), 'application/json');
      const id = Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
      await fs.promises.writeFile(path.join(REPORTS_DIR, id + '.html'), renderReport(data, id));
      return send(res, 201, JSON.stringify({ url: '/reports/' + id + '.html' }), 'application/json');
    }
    if (req.method === 'GET' && url.pathname.startsWith('/reports/')) {
      const name = url.pathname.slice('/reports/'.length);
      if (!/^[a-z0-9-]+\.html$/.test(name)) return send(res, 404, 'غير موجود');
      return serveFile(res, REPORTS_DIR, name);
    }
    if (req.method === 'GET') {
      return serveFile(res, PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
    }
    send(res, 405, 'Method Not Allowed');
  } catch (e) {
    send(res, 400, JSON.stringify({ error: 'طلب غير صالح' }), 'application/json');
  }
});

fs.mkdirSync(REPORTS_DIR, { recursive: true });
server.listen(PORT, HOST, () => console.log(`http://${HOST}:${PORT}`));
