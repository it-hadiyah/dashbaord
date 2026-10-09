/* مولّد التقرير المشترك بين المتصفح (للمعاينة) والخادم (للصفحة النهائية).
   يحوّل بيانات التقرير إلى HTML مصدر، ثم يقوم paginate.js بتقسيمه إلى صفحات A4. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./templates.js'));
  else root.RBR = factory(root.RBT);
})(typeof self !== 'undefined' ? self : this, function (T) {
  'use strict';

  const SERIES = ['#1f7a5c', '#3cc79a', '#145a43', '#e0b04a', '#d96c4f', '#7d93a8'];
  const ALLOWED = new Set(['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'h3', 'h4', 'blockquote']);
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  const escRaw = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[,٬\s%]/g, '').replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d))); return Number.isFinite(n) ? n : 0; };
  const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const short = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  /* ---------- تنظيف HTML الغني (قائمة بيضاء، بدون أي سمات) ---------- */
  function escText(s, map) {
    s = String(s).replace(/&(?!(?:amp|lt|gt|quot|nbsp|#\d{1,6}|#x[0-9a-fA-F]{1,6});)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return map ? map(s) : s;
  }
  function sanitize(html, map) {
    html = String(html == null ? '' : html).replace(/<(script|style|iframe|object|embed|noscript|template|textarea|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '');
    const out = [], stack = [];
    const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
    let last = 0, m;
    while ((m = re.exec(html))) {
      out.push(escText(html.slice(last, m.index), map));
      last = re.lastIndex;
      if (!m[2]) continue;
      const tag = m[2].toLowerCase(), close = !!m[1];
      if (tag === 'br') { if (!close) out.push('<br>'); continue; }
      const norm = { b: 'strong', i: 'em', div: 'p', h1: 'h3', h2: 'h3', h5: 'h4', h6: 'h4' }[tag] || tag;
      if (!ALLOWED.has(norm)) continue;
      if (close) { const i = stack.lastIndexOf(norm); if (i >= 0) while (stack.length > i) out.push('</' + stack.pop() + '>'); }
      else { stack.push(norm); out.push('<' + norm + '>'); }
    }
    out.push(escText(html.slice(last), map));
    while (stack.length) out.push('</' + stack.pop() + '>');
    return out.join('');
  }
  const plain = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();

  /* ---------- الرسوم البيانية (SVG بدون مكتبات) ---------- */
  function chartSvg(c, E) {
    const data = (c.data || []).map((d) => ({ label: String(d.label == null ? '' : d.label), value: num(d.value) })).filter((d) => d.label || d.value);
    if (!data.length) return '';
    const unit = c.unit ? E(c.unit) : '';
    const max = Math.max(...data.map((d) => d.value), 1);
    const W = 480, H = 250, kind = c.kind;
    const grid = (t, ih, l, r) => [0.25, 0.5, 0.75, 1].map((p) => `<line class="gl" x1="${l}" x2="${W - r}" y1="${t + ih - ih * p}" y2="${t + ih - ih * p}"/>`).join('');

    if (kind === 'bar') {
      const p = { l: 14, r: 14, t: 26, b: 40 }, iw = W - p.l - p.r, ih = H - p.t - p.b, step = iw / data.length, bw = Math.min(64, step * 0.62);
      const bars = data.map((d, i) => {
        const h = (d.value / max) * ih, x = p.l + i * step + (step - bw) / 2, y = p.t + ih - h;
        return `<rect class="bar s0" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, 0).toFixed(1)}" rx="4"/>
          <text class="v" x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle">${E(fmt(d.value))}${unit}</text>
          <text class="l" x="${(x + bw / 2).toFixed(1)}" y="${H - 16}" text-anchor="middle">${E(short(d.label, 12))}</text>`;
      }).join('');
      return `<svg viewBox="0 0 ${W} ${H}" role="img">${grid(p.t, ih, p.l, p.r)}<line class="ax" x1="${p.l}" x2="${W - p.r}" y1="${p.t + ih}" y2="${p.t + ih}"/>${bars}</svg>`;
    }

    if (kind === 'line' || kind === 'area') {
      const p = { l: 30, r: 30, t: 28, b: 40 }, iw = W - p.l - p.r, ih = H - p.t - p.b, step = data.length > 1 ? iw / (data.length - 1) : 0;
      const pts = data.map((d, i) => [p.l + (data.length > 1 ? i * step : iw / 2), p.t + ih - (d.value / max) * ih]);
      const line = pts.map((q) => q.map((n) => n.toFixed(1)).join(',')).join(' ');
      const area = kind === 'area' ? `<polygon class="area s0" points="${p.l},${p.t + ih} ${line} ${pts[pts.length - 1][0].toFixed(1)},${p.t + ih}"/>` : '';
      const dots = data.map((d, i) => `<circle class="dot s0" cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="4.5"/>
        <text class="v" x="${pts[i][0].toFixed(1)}" y="${(pts[i][1] - 10).toFixed(1)}" text-anchor="middle">${E(fmt(d.value))}${unit}</text>
        <text class="l" x="${pts[i][0].toFixed(1)}" y="${H - 16}" text-anchor="middle">${E(short(d.label, 12))}</text>`).join('');
      return `<svg viewBox="0 0 ${W} ${H}" role="img">${grid(p.t, ih, p.l, p.r)}<line class="ax" x1="${p.l}" x2="${W - p.r}" y1="${p.t + ih}" y2="${p.t + ih}"/>${area}<polyline class="ln s0" points="${line}"/>${dots}</svg>`;
    }

    if (kind === 'hbar') {
      const rowH = Math.min(34, 200 / data.length), gap = 10, labelW = 110, top = 6;
      const rows = data.map((d, i) => {
        const w = Math.max((d.value / max) * (W - labelW - 80), 0), y = top + i * (rowH + gap);
        return `<text class="l" x="${W - 4}" y="${y + rowH / 2 + 4}" text-anchor="end">${E(short(d.label, 16))}</text>
          <rect class="bar s0" x="${(W - labelW - w).toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${rowH}" rx="4"/>
          <text class="v" x="${(W - labelW - w - 8).toFixed(1)}" y="${y + rowH / 2 + 4}" text-anchor="end">${E(fmt(d.value))}${unit}</text>`;
      }).join('');
      return `<svg viewBox="0 0 ${W} ${top + data.length * (rowH + gap)}" role="img">${rows}</svg>`;
    }

    // donut
    const total = data.reduce((s, d) => s + d.value, 0) || 1, R = 70, C = 2 * Math.PI * R;
    let off = 0;
    const arcs = data.map((d, i) => {
      const len = (d.value / total) * C;
      const el = `<circle class="arc s${i % 6}" cx="100" cy="100" r="${R}" fill="none" stroke-width="30" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 100 100)"/>`;
      off += len; return el;
    }).join('');
    const centre = data.length === 1 ? Math.round(data[0].value) + '%' : fmt(total);
    const legend = data.map((d, i) => `<li><i class="sw s${i % 6}"></i><span>${E(d.label)}</span><b><bdi>${E(fmt(d.value))}${unit}</bdi></b><em>${Math.round((d.value / total) * 100)}%</em></li>`).join('');
    return `<div class="donut"><svg viewBox="0 0 200 200" role="img">${arcs}<text class="big" x="100" y="108" text-anchor="middle">${E(centre)}</text></svg><ul class="legend">${legend}</ul></div>`;
  }

  /* ---------- أقسام التقرير ---------- */
  function isEmptySection(s) {
    const c = s.content;
    switch (s.type) {
      case 'text': return !plain(c);
      case 'list': return !(c && (c.items || []).some((i) => String(i).trim()));
      case 'table': return !(c && (c.rows || []).some((r) => r.some((x) => String(x).trim())));
      case 'kpi': return !(c && (c.items || []).some((k) => k && (k.label || k.value)));
      case 'chart': return !(c && (c.data || []).some((d) => d && (d.label || d.value)));
      case 'progress': return !(c && (c.items || []).some((i) => i && (i.label || i.value)));
      case 'timeline': return !(c && (c.items || []).some((i) => i && (i.title || i.date)));
      case 'image': return !(c && c.src);
      case 'callout': return !(c && String(c.text || '').trim());
      case 'pagebreak': return false;
      default: return true;
    }
  }

  const SAFE_IMG = /^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

  function makeRenderer(report, ctx) {
    ctx = ctx || {};
    const opts = Object.assign({}, T.DEFAULT_OPTIONS, report.options || {});
    const map = opts.arabicDigits ? (s) => s.replace(/[0-9]/g, (d) => AR_DIGITS[d]) : null;
    const E = (v) => { const s = escRaw(v); return map ? map(s) : s; };
    const cfg = ctx.config || {};

    function body(s) {
      const c = s.content || {};
      switch (s.type) {
        case 'text': return `<div class="rt" data-split>${sanitize(c, map)}</div>`;
        case 'list': {
          const tag = c.ordered ? 'ol' : 'ul';
          return `<${tag} class="lst" data-split>${(c.items || []).filter((i) => String(i).trim()).map((i) => `<li>${E(i)}</li>`).join('')}</${tag}>`;
        }
        case 'table': {
          const heads = (c.headers || []).map((h) => `<th>${E(h)}</th>`).join('');
          const rows = (c.rows || []).filter((r) => r.some((x) => String(x).trim())).map((r) => `<tr>${r.map((x) => `<td>${E(x)}</td>`).join('')}</tr>`).join('');
          return `<div class="tw"><table class="tbl${c.zebra === false ? '' : ' zebra'}"><thead><tr>${heads}</tr></thead><tbody data-split>${rows}</tbody></table></div>`;
        }
        case 'kpi': {
          const items = (c.items || []).filter((k) => k && (k.label || k.value));
          return `<div class="kpis ${c.style === 'highlights' ? 'hl' : 'cards'}">${items.map((k) => {
            const t = String(k.trend || '').trim(), down = /^[-−]/.test(t);
            const trend = t ? `<em class="${down ? 'dn' : 'up'}"><span aria-hidden="true">${down ? '▼' : '▲'}</span> <bdi>${E(t.replace(/^[-−+]/, ''))}</bdi></em>` : '';
            return `<div class="kpi"><span class="kl">${E(k.label)}</span><b class="kv"><bdi>${E(k.value)}</bdi></b>${trend}</div>`;
          }).join('')}</div>`;
        }
        case 'chart': return `<figure class="chart ck-${escRaw(c.kind || 'bar')}">${chartSvg(c, E)}</figure>`;
        case 'progress':
          return `<div class="prog">${(c.items || []).filter((i) => i && (i.label || i.value)).map((i) => {
            const v = Math.max(0, Math.min(100, num(i.value)));
            return `<div class="pr"><div class="pl"><span>${E(i.label)}</span><b><bdi>${E(fmt(v))}%</bdi></b></div><div class="pbar" role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100"><i style="width:${v}%"></i></div></div>`;
          }).join('')}</div>`;
        case 'timeline':
          return `<ol class="tl" data-split>${(c.items || []).filter((i) => i && (i.title || i.date)).map((i) =>
            `<li class="st-${['done', 'active', 'todo'].includes(i.status) ? i.status : 'todo'}"><span class="td">${E(i.date)}</span><div><b>${E(i.title)}</b>${i.desc ? `<p>${E(i.desc)}</p>` : ''}</div></li>`).join('')}</ol>`;
        case 'image':
          return SAFE_IMG.test(c.src || '') ? `<figure class="img"><img src="${c.src}" alt="${E(c.caption || s.title || '')}" style="max-height:${Math.max(60, Math.min(600, parseInt(c.height, 10) || 220))}px;object-fit:${c.fit === 'cover' ? 'cover' : 'contain'}">${c.caption ? `<figcaption>${E(c.caption)}</figcaption>` : ''}</figure>` : '';
        case 'callout': return `<div class="call tone-${['info', 'success', 'warn'].includes(c.tone) ? c.tone : 'info'}"><p>${E(c.text).replace(/\r?\n/g, '<br>')}</p></div>`;
        default: return '';
      }
    }

    function section(s, i) {
      if (s.visible === false) return '';
      if (s.type === 'pagebreak') return `<div class="blk pb" data-sid="${escRaw(s.id)}"></div>`;
      const empty = isEmptySection(s);
      if (empty && !ctx.preview) return '';
      const title = s.title ? `<h2 class="bt">${E(s.title)}</h2>` : '';
      const w = s.width === 'half' ? 'half' : 'full';
      if (empty) return `<section class="blk ph w-${w}" data-sid="${escRaw(s.id)}" data-title="${escRaw(s.title)}">${title}<p class="phm">${E(s.hint || 'سيظهر هنا ما تكتبه في هذا القسم')}</p></section>`;
      return `<section class="blk b-${s.type} w-${w}" data-sid="${escRaw(s.id)}" data-title="${escRaw(s.title)}">${title}${body(s)}</section>`;
    }

    function logoHtml(cls) { return cfg.logo ? `<img class="${cls}" src="${escRaw(cfg.logo)}" alt="">` : ''; }

    function cover() {
      if (opts.cover === false) return '';
      const t = T.byId(report.template);
      const meta = [report.employee && `<div><span>إعداد</span><b>${E(report.employee)}</b></div>`, report.department && `<div><span>الإدارة / القسم</span><b>${E(report.department)}</b></div>`, report.date && `<div><span>التاريخ</span><b><bdi>${E(report.date)}</bdi></b></div>`].filter(Boolean).join('');
      return `<div class="cover-src cv-${escRaw(t.cover)}">
        <div class="cv-top">${logoHtml('cv-logo')}<div class="cv-org"><strong>${E(cfg.orgName)}</strong><span>${E(cfg.orgSubName)}</span></div></div>
        <div class="cv-main">${report.sample ? '<div class="ribbon">بيانات تجريبية</div>' : ''}<small class="cv-kind">${E(t.name)}</small><h1>${E(report.title || 'عنوان التقرير')}</h1>${report.subtitle ? `<p class="cv-sub">${E(report.subtitle)}</p>` : ''}${report.period ? `<p class="cv-period">${E(report.period)}</p>` : ''}</div>
        <div class="cv-meta">${meta}</div></div>`;
    }

    function closing() {
      if (!opts.closing) return '';
      const c = cfg.contact || {};
      const lines = [c.phone && `هاتف: <bdi>${E(c.phone)}</bdi>`, c.email && `<bdi>${E(c.email)}</bdi>`, c.website && `<bdi>${E(c.website)}</bdi>`, c.address && E(c.address)].filter(Boolean).map((l) => `<p>${l}</p>`).join('');
      return `<div class="closing-src">${logoHtml('cl-logo')}<h2>شكراً لكم</h2><p class="cl-org">${E(cfg.orgName)}</p>${lines}</div>`;
    }

    function source() {
      const secs = (report.sections || []).map(section).join('');
      const footer = opts.footerText || cfg.footerText || '';
      return `${cover()}
        ${opts.toc ? '<div class="toc-src"></div>' : ''}
        <div class="flow">${secs}</div>
        ${closing()}
        <template id="tpl-head">${opts.header === false ? '' : `<div class="sh">${logoHtml('sh-logo')}<span class="sh-org">${E(cfg.orgName)}</span><span class="sh-title">${E(report.title)}</span></div>`}</template>
        <template id="tpl-foot"><div class="sf"><span>${E(footer)}</span>${opts.pageNumbers === false ? '' : '<span class="pg">صفحة <b class="pn"></b> من <b class="pt"></b></span>'}</div></template>`;
    }

    function rootAttrs() {
      const p = T.PALETTES[report.palette] || T.PALETTES.green;
      const t = T.byId(report.template);
      return { style: `--a:${p.a};--d:${p.d};--s:${p.s};--x:${p.x}`, cls: `rpt h-${t.head} m-${['narrow', 'normal', 'wide'].includes(opts.margins) ? opts.margins : 'normal'}${opts.arabicDigits ? ' ad' : ''}`, title: `${report.title || 'تقرير'}${report.date ? ' - ' + report.date : ''}` };
    }
    return { source, rootAttrs, E };
  }

  function renderSource(report, ctx) { return makeRenderer(report, ctx).source(); }

  /* الصفحة الكاملة للتقرير المحفوظ */
  function renderPage(report, ctx) {
    ctx = ctx || {};
    const r = makeRenderer(report, ctx), a = r.rootAttrs();
    const id = ctx.id ? escRaw(ctx.id) : '';
    return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escRaw(a.title)}</title>
<link rel="icon" href="/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/tokens.css">
<link rel="stylesheet" href="/css/report.css">
</head>
<body class="${a.cls} view" style="${a.style}">
<div class="viewbar noprint">
  <div><strong>${escRaw(report.title || 'تقرير')}</strong><span id="pcount"></span></div>
  <div class="vb-actions">
    ${id ? `<a class="btn" href="/?edit=${id}">تعديل</a>` : ''}
    <a class="btn" href="/list.html">كل التقارير</a>
    <button class="btn primary" onclick="window.print()">طباعة / حفظ PDF</button>
  </div>
</div>
<div id="src" hidden>${r.source()}</div>
<div id="pages" class="pages"></div>
<script src="/js/paginate.js"></script>
</body>
</html>`;
  }

  return { sanitize, plain, chartSvg, isEmptySection, makeRenderer, renderSource, renderPage, escRaw, num, fmt, SAFE_IMG };
});
