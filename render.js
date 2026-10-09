'use strict';
// توليد صفحة HTML للتقرير: كليشة الجمعية + الأقسام + الرسوم البيانية (SVG بدون مكتبات)
const fs = require('fs');
const path = require('path');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const multiline = (v) => esc(v).replace(/\r?\n/g, '<br>');
const PALETTE = ['#3cc79a', '#2a8c6e', '#7fdcbc', '#1d5f4a', '#a8e8d2', '#f2b84b', '#e0805a'];
const num = (v) => { const n = parseFloat(String(v).replace(/[,٬\s]/g, '')); return Number.isFinite(n) ? n : 0; };
const fmt = (n) => Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 });

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch (e) { return {}; }
}

function chartSvg(kind, data) {
  const items = (data || []).map((d) => ({ label: String(d.label ?? ''), value: num(d.value) })).filter((d) => d.label || d.value);
  if (!items.length) return '';
  const max = Math.max(...items.map((d) => d.value), 1);
  const W = 420, H = 230;

  if (kind === 'bar') {
    const pad = { l: 10, r: 10, t: 22, b: 36 }, iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, bw = iw / items.length;
    const bars = items.map((d, i) => {
      const h = (d.value / max) * ih, x = pad.l + i * bw + bw * 0.15, y = pad.t + ih - h;
      return `<rect x="${x}" y="${y}" width="${bw * 0.7}" height="${h}" rx="3" fill="${PALETTE[0]}"/>
        <text x="${x + bw * 0.35}" y="${y - 5}" text-anchor="middle" class="v">${esc(fmt(d.value))}</text>
        <text x="${x + bw * 0.35}" y="${H - 14}" text-anchor="middle" class="l">${esc(d.label)}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img"><line x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + ih}" y2="${pad.t + ih}" stroke="#cfd6de"/>${bars}</svg>`;
  }

  if (kind === 'line') {
    const pad = { l: 24, r: 24, t: 24, b: 36 }, iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const step = items.length > 1 ? iw / (items.length - 1) : 0;
    const pts = items.map((d, i) => [pad.l + i * step, pad.t + ih - (d.value / max) * ih]);
    const dots = items.map((d, i) => `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="4" fill="${PALETTE[0]}"/>
      <text x="${pts[i][0]}" y="${pts[i][1] - 9}" text-anchor="middle" class="v">${esc(fmt(d.value))}</text>
      <text x="${pts[i][0]}" y="${H - 14}" text-anchor="middle" class="l">${esc(d.label)}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img"><line x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + ih}" y2="${pad.t + ih}" stroke="#cfd6de"/>
      <polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${PALETTE[0]}" stroke-width="3" stroke-linejoin="round"/>${dots}</svg>`;
  }

  if (kind === 'hbar') {
    const rowH = Math.min(40, 190 / items.length), top = 10, labelW = 90;
    const rows = items.map((d, i) => {
      const w = (d.value / max) * (W - labelW - 70), y = top + i * (rowH + 6);
      return `<text x="${W - 4}" y="${y + rowH / 2 + 4}" text-anchor="end" class="l">${esc(d.label)}</text>
        <rect x="${W - labelW - w}" y="${y}" width="${w}" height="${rowH}" rx="3" fill="${PALETTE[0]}"/>
        <text x="${W - labelW - w - 6}" y="${y + rowH / 2 + 4}" text-anchor="end" class="v">${esc(fmt(d.value))}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${top + items.length * (rowH + 6)}" role="img">${rows}</svg>`;
  }

  // donut
  const total = items.reduce((s, d) => s + d.value, 0) || 1;
  const R = 70, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = items.map((d, i) => {
    const len = (d.value / total) * C;
    const el = `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="28" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)"/>`;
    offset += len;
    return el;
  }).join('');
  const centre = items.length === 1 ? `${Math.round(items[0].value)}%` : fmt(total);
  const legend = items.map((d, i) => `<div><i style="background:${PALETTE[i % PALETTE.length]}"></i>${esc(d.label)} <b>${esc(fmt(d.value))}</b></div>`).join('');
  return `<div class="donut"><svg viewBox="0 0 200 200" role="img">${arcs}<text x="100" y="108" text-anchor="middle" class="big">${esc(centre)}</text></svg><div class="legend">${legend}</div></div>`;
}

function renderSection(s) {
  const cls = s.width === 'half' ? 'half' : 'full';
  const title = s.title ? `<h2>${esc(s.title)}</h2>` : '';
  let inner = '';
  switch (s.type) {
    case 'text':
      inner = `${title}<p>${multiline(s.content)}</p>`; break;
    case 'list': {
      const items = (Array.isArray(s.content) ? s.content : []).filter(Boolean);
      inner = `${title}<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`; break;
    }
    case 'kpi': {
      const items = (Array.isArray(s.content) ? s.content : []).filter((k) => k && (k.label || k.value));
      inner = `${title}<div class="kpis">${items.map((k) => {
        const t = String(k.trend || '').trim();
        const down = /^[-−]/.test(t);
        return `<div class="kpi"><span class="kl">${esc(k.label)}</span><b>${esc(k.value)}</b>${t ? `<em class="${down ? 'down' : 'up'}">${down ? '▼' : '▲'} ${esc(t.replace(/^[-−+]/, ''))}</em>` : ''}</div>`;
      }).join('')}</div>`; break;
    }
    case 'table': {
      const c = s.content || {};
      const head = (c.headers || []).map((h) => `<th>${esc(h)}</th>`).join('');
      const body = (c.rows || []).map((r) => `<tr>${r.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('');
      inner = `${title}<div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`; break;
    }
    case 'chart': {
      const c = s.content || {};
      inner = `${title}${chartSvg(c.kind, c.data)}`; break;
    }
    default:
      return '';
  }
  return `<section class="card ${cls}${s.type === 'text' || s.type === 'list' || s.type === 'table' ? ' plain' : ''}">${inner}</section>`;
}

function renderReport(d, id) {
  const cfg = loadConfig();
  const c = cfg.contact || {};
  const contact = [c.phone && `هاتف: ${esc(c.phone)}`, c.email && esc(c.email), c.website && esc(c.website), c.address && esc(c.address)].filter(Boolean).join(' · ');
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.title)}</title>
<link rel="stylesheet" href="/report.css">
<style>:root{--c:${esc(cfg.color || '#3cc79a')};--d:${esc(cfg.darkColor || '#2a8c6e')}}</style>
</head>
<body>
<div class="page">
  <header class="letterhead">
    <div class="org">
      ${cfg.logo ? `<img src="${esc(cfg.logo)}" alt="">` : ''}
      <div><strong>${esc(cfg.orgName)}</strong><span>${esc(cfg.orgSubName)}</span></div>
    </div>
    <div class="ref"><div>رقم التقرير: ${esc(id)}</div>${d.date ? `<div>التاريخ: ${esc(d.date)}</div>` : ''}</div>
  </header>
  <div class="titlebar"><small>${esc(d.type)}</small><h1>${esc(d.title)}</h1></div>
  <div class="byline"><span>إعداد: <b>${esc(d.employee)}</b></span>${d.department ? `<span>الإدارة / القسم: <b>${esc(d.department)}</b></span>` : ''}</div>
  <main class="body">
    ${(d.sections || []).map(renderSection).join('\n    ')}
  </main>
  <footer class="letterfoot">
    <div>${esc(cfg.footerText)}</div>
    ${contact ? `<div>${contact}</div>` : ''}
  </footer>
  <div class="actions noprint"><a href="/">تقرير جديد</a> · <a href="/list.html">كل التقارير</a> · <a href="javascript:window.print()">طباعة / حفظ PDF</a></div>
</div>
</body>
</html>`;
}

module.exports = { renderReport };
