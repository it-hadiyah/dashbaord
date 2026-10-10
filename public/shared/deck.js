/* نموذج العروض التقديمية المشترك بين المتصفح والخادم:
   شرائح مبنية على تخطيطات جاهزة، وتعيد استخدام أقسام التقرير (رسوم، جداول، مؤشرات، مقارنات...) كمحتوى للشريحة.
   الكتل المستخدمة تُخزَّن في deck.sections (نفس شكل أقسام التقرير) وتشير إليها الشريحة بـ blockId. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./templates.js'), require('./render.js'));
  else root.RBD = factory(root.RBT, root.RBR);
})(typeof self !== 'undefined' ? self : this, function (T, R) {
  'use strict';

  const RATIOS = { '16:9': { w: 1280, h: 720, name: 'عريض 16:9' }, '4:3': { w: 960, h: 720, name: 'قياسي 4:3' } };
  const LAYOUTS = {
    cover: { name: 'غلاف', bg: 'brand' },
    section: { name: 'عنوان قسم', bg: 'brand' },
    content: { name: 'محتوى', bg: 'light' },
    closing: { name: 'ختام', bg: 'brand' },
  };
  const BGS = { light: 'أبيض', tint: 'فاتح ملوّن', dark: 'داكن', brand: 'هوية الجمعية' };
  const BLOCK_TYPES = ['kpi', 'chart', 'table', 'compare', 'calc', 'progress', 'timeline', 'gantt', 'image', 'callout'];
  const uid = T.uid;
  const esc = R.escRaw;

  function newSlide(layout, o) {
    o = o || {};
    return { id: uid(), layout: LAYOUTS[layout] ? layout : 'content', bg: o.bg || LAYOUTS[layout || 'content'].bg, title: o.title || '', subtitle: o.subtitle || '', bullets: (o.bullets || []).slice(), notes: o.notes || '', blockIds: (o.blockIds || []).slice(), hint: o.hint || '' };
  }

  const idsOf = (slide) => (Array.isArray(slide.blockIds) && slide.blockIds.length ? slide.blockIds : slide.blockId ? [slide.blockId] : []);
  function blocksOf(deck, slide) { return idsOf(slide).map((id) => (deck.sections || []).find((s) => s.id === id)).filter(Boolean); }
  const blockOf = (deck, slide) => blocksOf(deck, slide)[0] || null;

  /* ---------- الرسم ---------- */
  function ctxReport(deck) { return { options: Object.assign({}, T.DEFAULT_OPTIONS, deck.options || {}), palette: deck.palette, template: 'blank', sections: [] }; }

  function renderSlide(deck, slide, ctx) {
    ctx = ctx || {};
    const r = R.makeRenderer(ctxReport(deck), ctx), E = r.E, cfg = ctx.config || {};
    const L = slide.layout, bg = slide.bg || LAYOUTS[L].bg;
    const dark = bg === 'brand' || bg === 'dark';
    const logo = r.logoHtml('s-logo', { light: dark });
    const pat = r.patternHtml('s-pattern', true);
    const idx = ctx.index || 0, total = ctx.total || 0;
    const foot = deck.options && deck.options.pageNumbers === false ? '' : `<div class="s-foot"><span>${E(deck.options && deck.options.footerText || cfg.orgName || '')}</span><span class="s-pg">شريحة <bdi>${E(String(idx + 1))}</bdi> من <bdi>${E(String(total || ''))}</bdi></span></div>`;
    const sample = deck.sample ? '<div class="s-ribbon">بيانات تجريبية</div>' : '';
    let inner = '';
    if (L === 'cover') {
      const meta = [deck.presenter && `<span>${E(deck.presenter)}</span>`, deck.date && `<span><bdi>${E(deck.date)}</bdi></span>`].filter(Boolean).join('');
      inner = `<div class="s-cover">${logo}${sample}<div class="s-ctext"><small>${E(cfg.orgName || '')}</small><h1>${E(slide.title || deck.title)}</h1>${slide.subtitle ? `<p>${E(slide.subtitle)}</p>` : ''}<div class="s-meta">${meta}</div></div>${pat}</div>`;
    } else if (L === 'section') {
      inner = `<div class="s-sec">${logo}<h2>${E(slide.title)}</h2>${slide.subtitle ? `<p>${E(slide.subtitle)}</p>` : ''}${pat}</div>`;
    } else if (L === 'closing') {
      const c = cfg.contact || {};
      const lines = [c.phone && `<bdi>${E(c.phone)}</bdi>`, c.email && `<bdi>${E(c.email)}</bdi>`, c.website && `<bdi>${E(c.website)}</bdi>`].filter(Boolean).map((x) => `<p>${x}</p>`).join('');
      inner = `<div class="s-sec s-close">${r.logoHtml('s-logo big', { light: true, vertical: true })}<h2>${E(slide.title || 'شكراً لكم')}</h2>${slide.subtitle ? `<p>${E(slide.subtitle)}</p>` : `<p>${E(cfg.orgName || '')}</p>`}${lines}${pat}</div>`;
    } else {
      const bl = (slide.bullets || []).filter((b) => String(b).trim());
      const blocks = blocksOf(deck, slide).map((b) => R.applyRef(b, ctx.indicators));
      const real = blocks.filter((b) => !R.isEmptySection(b));
      const shown = ctx.preview ? blocks : real;
      const z = shown.length <= 1 ? 1.6 : shown.length === 2 ? 1.2 : 1.0;
      const cells = shown.map((b) => (R.isEmptySection(b)
        ? `<div class="s-wrap w-${b.width === 'half' ? 'half' : 'full'}"><div class="s-block s-ph">${E(b.hint || slide.hint || 'أضف بيانات لهذا القسم من لوحة التحرير')}</div></div>`
        : `<div class="s-wrap w-${b.width === 'half' ? 'half' : 'full'}"><div class="s-block b-${esc(b.type)}" style="zoom:${z}">${r.body(b)}</div>${r.sourceNote(b)}</div>`));
      let main = cells.length ? `<div class="s-blocks${shown.length > 1 ? ' multi' : ''}">${shown.map((b, i) => (b.title && !R.isEmptySection(b) ? cells[i].replace('<div class="s-block ', `<h3 class="s-bt">${E(b.title)}</h3><div class="s-block `) : cells[i])).join('')}</div>` : '';
      if (!main && !bl.length && ctx.preview) main = `<div class="s-blocks"><div class="s-wrap w-full"><div class="s-block s-ph">${E(slide.hint || 'اكتب نقاط هذه الشريحة أو أضف قسماً من لوحة التحرير')}</div></div></div>`;
      const list = bl.length ? `<ul class="s-list">${bl.map((b) => `<li>${E(b)}</li>`).join('')}</ul>` : '';
      const two = main && list ? ' two' : '';
      inner = `<div class="s-content">${logo}<h2 class="s-title">${E(slide.title)}</h2>${slide.subtitle ? `<p class="s-sub">${E(slide.subtitle)}</p>` : ''}<div class="s-body${two}">${list}${main}</div></div>`;
    }
    return `<section class="slide L-${L} bg-${esc(bg)}" data-sid="${esc(slide.id)}">${inner}${L === 'content' || ctx.allFoot ? foot : ''}</section>`;
  }

  function rootStyle(deck) {
    const p = T.PALETTES[deck.palette] || T.PALETTES.hadiyah || T.PALETTES.green;
    const rt = RATIOS[deck.ratio] || RATIOS['16:9'];
    return `--a:${p.a};--d:${p.d};--s:${p.s};--x:${p.x};--sw:${rt.w}px;--sh:${rt.h}px`;
  }

  /* صفحة العرض الكاملة (للمعاينة التقديمية والتصدير كصفحة ويب) */
  function renderDeckPage(deck, ctx) {
    ctx = ctx || {};
    const n = deck.slides.length;
    const slides = deck.slides.map((s, i) => renderSlide(deck, s, Object.assign({}, ctx, { index: i, total: n }))).join('');
    const notes = JSON.stringify(deck.slides.map((s) => s.notes || ''));
    const base = ctx.assetBase || '';
    const css = ctx.inlineCss ? `<style>${ctx.inlineCss}</style>` : (ctx.wf ? ['tokens', 'report', 'components', 'deck'] : ['tokens', 'report', 'deck']).map((f) => `<link rel="stylesheet" href="${base}/css/${f}.css">`).join('');
    const printOk = ctx.allowPrint !== false;
    return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(deck.title || 'عرض تقديمي')}</title>
<link rel="icon" href="${base}/brand/logo-icon.png" type="image/png">
${css}
<style>@page{size:${(RATIOS[deck.ratio] || RATIOS['16:9']).w}px ${(RATIOS[deck.ratio] || RATIOS['16:9']).h}px;margin:0}${printOk ? '' : '@media print{body{display:none}}'}</style>
</head>
<body class="deck-view rpt ${deck.ratio === '4:3' ? 'r43' : 'r169'}" style="${rootStyle(deck)}" data-did="${esc(ctx.id || '')}" data-rid="${ctx.wf ? esc(ctx.id || '') : ''}" data-kind="deck">
<div class="dv-bar noprint">
  <strong>${esc(deck.title || 'عرض تقديمي')}</strong><span id="vb-status" class="chip-status"></span>
  <span class="dv-actions" id="vb-actions">${ctx.actions || ''}<button type="button" id="dv-present" class="btn primary">عرض بملء الشاشة</button>${printOk ? '<button type="button" class="btn" onclick="window.print()">طباعة / PDF</button>' : ''}</span>
</div>
<div class="dv-stage" id="dv-stage">${slides}</div>
<div class="dv-pres" id="dv-pres" hidden><div class="dp-view" id="dp-view"></div><div class="dp-ctl noprint"><button type="button" id="dp-prev" aria-label="السابقة">›</button><span id="dp-n"></span><button type="button" id="dp-next" aria-label="التالية">‹</button><button type="button" id="dp-notes">ملاحظات</button><button type="button" id="dp-exit">خروج</button></div><div class="dp-notes" id="dp-nt" hidden></div></div>
<script>window.__NOTES=${notes.replace(/</g, '\\u003c')};window.__ALLOW_PRINT=${printOk};</script>
<script src="${base}/js/deck-present.js"></script>
${ctx.wf ? '<script src="/js/guard.js"></script><script type="module" src="/js/viewbar.js"></script><div id="toasts" class="toasts"></div>' : ''}
</body>
</html>`;
  }

  /* ---------- بناء عرض من قالب ---------- */
  const mk = (type, title, content) => ({ type, title: title || '', content });
  const HINTS = { cover: 'اكتب عنوان العرض والعنوان الفرعي (واسم المقدّم والتاريخ من «إعدادات العرض كله»).', section: 'اكتب عنوان هذا القسم من العرض.', closing: 'شريحة الختام: يمكنك تغيير عبارة الشكر.',
    kpi: 'اختر «مؤشرات رئيسية» وأدخل أهم 3 إلى 4 أرقام مع نسبة تغيّرها.', chart: 'أدخل التسميات والقيم لتظهر في الرسم، أو اربطه بمؤشر مركزي.', table: 'أدخل عناوين الأعمدة وصفوف الجدول، أو استوردها من Excel.', compare: 'أدخل قيمة كل بند في الفترتين وستظهر نسبة الارتفاع أو الانخفاض تلقائياً.', calc: 'أدخل الأرقام وسيُحسب المتبقي والنسبة تلقائياً.', progress: 'أدخل نسبة إنجاز كل بند.', timeline: 'اذكر المراحل وتواريخها وحالتها.', gantt: 'أدخل المهام بتواريخ البداية والنهاية.', callout: 'اكتب الملاحظة المهمة.', image: 'أضف صورة.', bullets: 'اكتب النقاط الرئيسية لهذه الشريحة، كل نقطة في سطر.' };
  const autoHint = (d) => d.hint || (d.layout === 'cover' || d.layout === 'section' || d.layout === 'closing' ? HINTS[d.layout] : d.blocks && d.blocks.length > 1 ? 'أضف أقسام هذه الشريحة وعبّئ كل قسم، ويمكنك جعل القسم بنصف العرض ليجاور غيره.' : (d.block || (d.blocks && d.blocks[0])) ? HINTS[(d.block || d.blocks[0]).type] : HINTS.bullets);
  function attach(deck, defs) {
    deck.sections = []; deck.slides = [];
    defs.forEach((d) => {
      const s = newSlide(d.layout || 'content', d); s.hint = autoHint(d);
      (d.blocks || (d.block ? [d.block] : [])).forEach((bd) => { const b = T.makeSection(bd.type, bd.title || '', {}); b.content = JSON.parse(JSON.stringify(bd.content)); b.hint = ''; if (bd.width) b.width = bd.width; deck.sections.push(b); s.blockIds.push(b.id); });
      deck.slides.push(s);
    });
    return deck;
  }

  function baseDeck(o) {
    return { version: 1, kind: 'deck', id: null, template: o.template || 'blank', sample: !!o.sample, title: o.title || '', subtitle: o.subtitle || '', presenter: o.presenter || '', date: new Date().toISOString().slice(0, 10), ratio: o.ratio || '16:9', palette: o.palette || 'hadiyah', options: { pageNumbers: true, footerText: '', arabicDigits: false }, sections: [], slides: [] };
  }

  const K = (label, value, trend) => ({ label, value, trend: trend || '', icon: '' });
  const kpiB = (items, style) => mk('kpi', '', { style: style || 'cards', items: items.map((i) => K(i[0], i[1], i[2])) });
  const chartB = (kind, data, unit) => mk('chart', '', { kind, unit: unit || '', max: '', data: data.map((d) => ({ label: d[0], value: String(d[1]) })) });
  const tableB = (headers, rows) => mk('table', '', { headers, zebra: true, rows });
  const cmpB = (prev, curr, rows) => mk('compare', '', { labels: { prev, curr }, rows: rows.map((r) => ({ label: r[0], prev: String(r[1]), curr: String(r[2]), unit: r[3] || '', better: r[4] || 'up' })), chart: true, summary: true, decimals: 1 });
  const inp = (key, label, value, unit) => ({ key, label, kind: 'input', value: String(value), unit: unit || 'ريال', fmt: 'number' });
  const cal = (key, label, op, args, fmtp) => ({ key, label, kind: 'calc', op, args, formula: '', unit: fmtp ? '' : 'ريال', fmt: fmtp ? 'percent' : 'number' });
  const calcB = (rows) => mk('calc', '', { style: 'table', rows });
  const progB = (items) => mk('progress', '', { items: items.map((i) => ({ label: i[0], value: String(i[1]) })) });
  const tlB = (items) => mk('timeline', '', { items: items.map((i) => ({ date: i[0], title: i[1], desc: '', status: i[2] || 'todo' })) });
  const half = (b) => Object.assign({}, b, { width: 'half' });
  const SL = (title, o) => Object.assign({ layout: 'content', title }, o || {});
  const SEC = (title, subtitle) => ({ layout: 'section', title, subtitle: subtitle || '' });
  const END = () => ({ layout: 'closing', title: 'شكراً لكم' });

  const TEMPLATES = [
    { id: 'about', name: 'التعريف بالجمعية', desc: 'من نحن، الرؤية والرسالة والقيم، الخدمات، وأرقام الأثر.', palette: 'hadiyah', slides: [
      { layout: 'cover', title: 'التعريف بالجمعية', subtitle: 'خدمة ضيوف الرحمن' },
      SL('من نحن', { bullets: ['جمعية أهلية تخدم الحجاج والمعتمرين', 'نعمل بروح الفريق وبشراكات مجتمعية', 'نقدّم برامج موسمية ودائمة'] }),
      SL('الرؤية والرسالة والقيم', { bullets: ['الرؤية: ريادة في خدمة ضيوف الرحمن', 'الرسالة: خدمات نوعية مستدامة', 'القيم: الإتقان، الأمانة، العطاء'] }),
      SL('أبرز الأرقام', { block: kpiB([['المستفيدون', '48,200', '+16%'], ['البرامج', '14', '+2'], ['المتطوعون', '1,450', '+9%'], ['الشراكات', '22', '+4']]) }),
      SL('برامجنا', { block: tableB(['البرنامج', 'الفئة المستهدفة', 'النطاق'], [['السقيا', 'الحجاج', 'مكة والمشاعر'], ['الإرشاد', 'المعتمرون', 'مكة والمدينة'], ['الضيافة', 'الحجاج', 'المشاعر']]) }),
      END()] },
    { id: 'annual', name: 'التقرير السنوي', desc: 'حصاد العام: مؤشرات ومقارنة ورسوم وإنجازات وخطة قادمة.', palette: 'hadiyah', slides: [
      { layout: 'cover', title: 'التقرير السنوي', subtitle: 'حصاد عام من العطاء' },
      SL('أبرز أرقام العام', { block: kpiB([['المستفيدون', '48,200', '+16%'], ['البرامج', '14', '+2'], ['المتطوعون', '1,450', '+9%']], 'highlights') }),
      SL('مقارنة بالعام الماضي', { block: cmpB('العام الماضي', 'العام الحالي', [['المستفيدون', 41500, 48200], ['ساعات التطوع', 9800, 12400], ['الشراكات', 18, 22]]) }),
      SL('توزيع الإنفاق على البرامج', { block: chartB('donut', [['الرعاية', 45], ['التعليم', 25], ['التشغيل', 20], ['أخرى', 10]], '%') }),
      SL('محطات العام', { block: tlB([['يناير', 'إطلاق الخطة السنوية', 'done'], ['يونيو', 'موسم العمرة', 'done'], ['ديسمبر', 'تقييم الأثر', 'active']]) }),
      SL('الخطة المستقبلية', { bullets: ['توسيع نطاق الخدمات', 'تعزيز الشراكات', 'رفع كفاءة التشغيل'] }),
      END()] },
    { id: 'achievements', name: 'الإنجازات', desc: 'أبرز إنجازات الفترة بالأرقام.', palette: 'teal', slides: [
      { layout: 'cover', title: 'الإنجازات', subtitle: 'ما تحقق خلال الفترة' },
      SL('إنجازات بارزة', { bullets: ['اكتمال المرحلة الأولى قبل الموعد', 'توقيع اتفاقيات شراكة جديدة', 'رفع رضا المستفيدين'] }),
      SL('الإنجاز مقابل المستهدف', { blocks: [Object.assign(half(progB([['التحول الرقمي', 90], ['الشراكات', 75], ['الاستدامة المالية', 60]])), { title: 'نسب الإنجاز' }), Object.assign(half(chartB('line', [['الربع 1', 55], ['الربع 2', 68], ['الربع 3', 80], ['الربع 4', 90]], '%')), { title: 'اتجاه الإنجاز' })] }),
      SL('تطور الإنجاز', { block: chartB('line', [['الربع 1', 55], ['الربع 2', 68], ['الربع 3', 80], ['الربع 4', 90]], '%') }),
      END()] },
    { id: 'projects', name: 'المشاريع والمبادرات', desc: 'حالة المشاريع وإنجازها وجدولها الزمني.', palette: 'plum', slides: [
      { layout: 'cover', title: 'المشاريع والمبادرات', subtitle: 'متابعة التنفيذ' },
      SL('نظرة عامة', { block: kpiB([['المشاريع الجارية', '8', ''], ['المكتملة', '5', '+2'], ['المتأخرة', '1', '-1']]) }),
      SL('حالة المشاريع', { block: tableB(['المشروع', 'المسؤول', 'الحالة', 'الإنجاز'], [['السقيا', 'إدارة البرامج', 'يسير وفق الخطة', '90%'], ['الإرشاد', 'إدارة البرامج', 'يسير وفق الخطة', '70%'], ['منصة التطوع', 'التقنية', 'متأخر', '45%']]) }),
      SL('الجدول الزمني', { block: tlB([['الربع 1', 'التخطيط', 'done'], ['الربع 2', 'التنفيذ', 'active'], ['الربع 3', 'الإطلاق', 'todo']]) }),
      END()] },
    { id: 'budget', name: 'الميزانية والمصروفات', desc: 'الميزانية والمصروف والمتبقي ونسبة الصرف.', palette: 'navy', slides: [
      { layout: 'cover', title: 'الميزانية والمصروفات', subtitle: 'متابعة الصرف' },
      SL('الموقف المالي', { block: calcB([inp('A', 'الميزانية المعتمدة', 2000000), inp('B', 'المصروف الفعلي', 1450000), cal('C', 'المتبقي', 'sub', ['A', 'B']), cal('D', 'نسبة الصرف', 'pct', ['B', 'A'], true)]) }),
      SL('المصروف حسب البند', { block: chartB('hbar', [['البرامج', 950], ['التشغيل', 310], ['الموارد', 130], ['التسويق', 60]], 'ألف ريال') }),
      SL('تفصيل الميزانية', { block: tableB(['البند', 'التقديري', 'الفعلي', 'الفرق'], [['البرامج', '1,200,000', '950,000', '250,000'], ['التشغيل', '400,000', '310,000', '90,000']]) }),
      END()] },
    { id: 'finperf', name: 'الأداء المالي', desc: 'إيرادات ومصروفات وفائض ومقارنة بالسنوات.', palette: 'hadiyah', slides: [
      { layout: 'cover', title: 'الأداء المالي', subtitle: 'الإيرادات والمصروفات' },
      SL('المؤشرات المالية', { blocks: [Object.assign(kpiB([['الإيرادات', '4.2 مليون', '+14%'], ['المصروفات', '3.65 مليون', '+10%'], ['الفائض', '550 ألف', '+37%']]), { title: 'أبرز الأرقام' }), Object.assign(chartB('bar', [['2023', 3100], ['2024', 3700], ['2025', 4200]], 'ألف ريال'), { title: 'نمو الإيرادات' })] }),
      SL('مقارنة السنوات', { block: tableB(['البند', '2023', '2024', '2025'], [['الإيرادات', '3,100,000', '3,700,000', '4,200,000'], ['المصروفات', '2,900,000', '3,300,000', '3,650,000'], ['الفائض', '200,000', '400,000', '550,000']]) }),
      SL('اتجاه الإيرادات', { block: chartB('bar', [['2023', 3100], ['2024', 3700], ['2025', 4200]], 'ألف ريال') }),
      SL('مصادر الإيراد', { block: chartB('pie', [['التبرعات', 62], ['الأوقاف', 21], ['الشراكات', 12], ['أخرى', 5]], '%') }),
      END()] },
    { id: 'kpi', name: 'مؤشرات الأداء KPI', desc: 'لوحة مؤشرات وتحقق الأهداف.', palette: 'sand', slides: [
      { layout: 'cover', title: 'مؤشرات الأداء', subtitle: 'KPI' },
      SL('المؤشرات الرئيسية', { block: kpiB([['رضا المستفيدين', '94%', '+3%'], ['زمن الاستجابة', '2.1 ساعة', '-12%'], ['تحقيق الأهداف', '88%', '+6%'], ['كفاءة التشغيل', '91%', '+2%']]) }),
      SL('مقارنة بالربع السابق', { block: cmpB('الربع السابق', 'الربع الحالي', [['رضا المستفيدين', 90, 94, '%'], ['كفاءة التشغيل', 89, 91, '%'], ['زمن الاستجابة', 2.4, 2.1, 'ساعة', 'down']]) }),
      SL('تحقق الأهداف', { block: chartB('gauge', [['تحقيق الأهداف', 88]], '%') }),
      END()] },
    { id: 'partners', name: 'الشركاء والمتبرعون', desc: 'شكر الشركاء والمتبرعين وأثر مساهماتهم.', palette: 'hadiyah', slides: [
      { layout: 'cover', title: 'الشركاء والمتبرعون', subtitle: 'شكراً لمن ساهم في العطاء' },
      SL('أثر المساهمات', { block: kpiB([['المتبرعون', '3,420', '+8%'], ['الشركاء', '22', '+4'], ['إجمالي التبرعات', '2.6 مليون', '+12%']]) }),
      SL('التبرعات حسب القناة', { block: chartB('donut', [['إلكتروني', 50], ['نقدي', 29], ['شراكات', 21]], '%') }),
      SL('كبار الشركاء', { block: tableB(['الشريك', 'نوع المساهمة', 'المساهمة'], [['شريك 1', 'تمويل', '500,000'], ['شريك 2', 'خدمات', '—'], ['شريك 3', 'تمويل', '300,000']]) }),
      END()] },
    { id: 'hajj', name: 'برنامج الحج والعمرة', desc: 'أداء الموسم: المستفيدون والخدمات والمتطوعون.', palette: 'hadiyah', slides: [
      { layout: 'cover', title: 'أداء برنامج الموسم', subtitle: 'الحج والعمرة' },
      SL('أرقام الموسم', { block: kpiB([['المستفيدون', '120,000', '+18%'], ['المتطوعون', '1,450', '+9%'], ['الخدمات', '310,000', '+22%'], ['الرضا', '95%', '+2%']], 'highlights') }),
      SL('مقارنة بالموسم السابق', { block: cmpB('الموسم السابق', 'الموسم الحالي', [['المستفيدون', 101500, 120000], ['الخدمات المقدمة', 254000, 310000]]) }),
      SL('الخدمات حسب النوع', { block: chartB('donut', [['سقيا', 120], ['ضيافة', 90], ['إرشاد', 60], ['رعاية', 40]], 'ألف') }),
      END()] },
    { id: 'strategic', name: 'الخطة الاستراتيجية', desc: 'الأهداف والمبادرات والمؤشرات والجدول الزمني.', palette: 'navy', slides: [
      { layout: 'cover', title: 'الخطة الاستراتيجية', subtitle: '2026 – 2030' },
      SL('الأهداف الاستراتيجية', { bullets: ['رفع جودة الخدمات', 'تنويع مصادر التمويل', 'التحول الرقمي', 'تعزيز الشراكات'] }),
      SL('المبادرات الرئيسية', { block: tableB(['المبادرة', 'الهدف', 'المسؤول', 'الموعد'], [['منصة رقمية', 'التحول الرقمي', 'التقنية', '2026'], ['صندوق وقفي', 'تنويع التمويل', 'المالية', '2027']]) }),
      SL('خارطة الطريق', { block: tlB([['2026', 'التأسيس', 'active'], ['2028', 'التوسع', 'todo'], ['2030', 'الريادة', 'todo']]) }),
      END()] },
    { id: 'results', name: 'نتائج المشروع', desc: 'نتائج مشروع: المستفيدون والأثر والتكلفة.', palette: 'teal', slides: [
      { layout: 'cover', title: 'نتائج المشروع', subtitle: 'ملخص الأثر' },
      SL('النتائج الرئيسية', { block: kpiB([['المستفيدون', '18,000', ''], ['الإنجاز', '90%', ''], ['تكلفة المستفيد', '44 ريال', '-8%']]) }),
      SL('الميزانية والتنفيذ', { block: calcB([inp('A', 'التبرعات', 800000), inp('B', 'المنفّذ', 720000), cal('C', 'المتبقي', 'sub', ['A', 'B']), cal('D', 'نسبة التنفيذ', 'pct', ['B', 'A'], true)]) }),
      SL('الدروس المستفادة', { bullets: ['التخطيط المبكر يرفع الجودة', 'الشراكات تخفض التكلفة', 'التوثيق ييسّر التقييم'] }),
      END()] },
    { id: 'blank', name: 'عرض فارغ', desc: 'ابدأ من الصفر.', palette: 'hadiyah', slides: [{ layout: 'cover', title: '', subtitle: '' }, SL('', {}), END()] },
  ];

  function createDeck(templateId, o) {
    o = o || {};
    const t = TEMPLATES.find((x) => x.id === templateId) || TEMPLATES[TEMPLATES.length - 1];
    const deck = baseDeck({ template: t.id, palette: t.palette, ratio: o.ratio, sample: o.sample, title: o.sample ? t.slides[0].title : '', subtitle: o.sample ? t.slides[0].subtitle : '' });
    const defs = t.slides.map((d) => (o.sample ? d : Object.assign({}, d, { blocks: (d.blocks || (d.block ? [d.block] : [])).map((x) => ({ type: x.type, title: x.title, width: x.width, content: T.emptyContent(x.type) })), block: null, bullets: [], title: d.layout === 'cover' || d.layout === 'closing' ? d.title : d.title, subtitle: d.layout === 'cover' ? '' : d.subtitle })));
    return attach(deck, defs);
  }

  /* ---------- تحويل التقرير إلى عرض ---------- */
  const strip = (h) => String(h || '').replace(/<\/(p|li|h3|h4|blockquote)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const clip = (s, n) => { s = s.trim().replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const PRIO = { kpi: 10, compare: 9, calc: 9, chart: 8, gantt: 6, table: 6, progress: 6, timeline: 5, callout: 4, text: 3, list: 3, image: 2 };

  function fromReport(report, o) {
    o = o || {};
    const max = Math.max(4, Math.min(60, o.maxSlides || 12));
    const deck = baseDeck({ template: 'from-report', palette: report.palette || 'hadiyah', title: report.title, subtitle: report.subtitle, presenter: report.employee, ratio: o.ratio });
    deck.date = report.date || deck.date; deck.sourceReport = report.id || null;
    const items = [];
    (report.sections || []).forEach((s) => {
      if (s.visible === false || s.type === 'pagebreak' || R.isEmptySection(s)) return;
      const title = s.title || (T.BLOCKS[s.type] || {}).name || '';
      const pr = PRIO[s.type] || 1;
      if (s.type === 'text') {
        const lines = strip(typeof s.content === 'string' ? s.content : '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
        if (lines.length) items.push({ pr, defs: [SL(title, { bullets: lines.slice(0, 6).map((x) => clip(x, 160)) })] });
      } else if (s.type === 'list') {
        const its = (s.content.items || []).map((x) => String(x).trim()).filter(Boolean);
        const defs = []; for (let i = 0; i < its.length && i < 14; i += 7) defs.push(SL(title + (i ? ' (تابع)' : ''), { bullets: its.slice(i, i + 7).map((x) => clip(x, 160)) }));
        items.push({ pr, defs });
      } else if (s.type === 'callout') {
        items.push({ pr, defs: [SL(title, { bullets: [clip(String(s.content.text || ''), 220)] })] });
      } else if (s.type === 'table') {
        const rows = (s.content.rows || []).filter((r) => r.some((x) => String(x).trim()));
        const defs = []; for (let i = 0; i < rows.length && i < 24; i += 8) defs.push(SL(title + (i ? ' (تابع)' : ''), { block: { type: 'table', content: Object.assign({}, s.content, { rows: rows.slice(i, i + 8) }) } }));
        items.push({ pr, defs });
      } else {
        items.push({ pr, defs: [SL(title, { block: { type: s.type, content: s.content } })] });
      }
    });
    let budget = max - 2, kept = items;
    const count = (arr) => arr.reduce((n, it) => n + it.defs.length, 0);
    if (count(items) > budget) {
      // نقتطع أولاً الشرائح التابعة ثم نحتفظ بالأعلى أولوية مع الحفاظ على ترتيب التقرير
      items.forEach((it) => { it.defs = it.defs.slice(0, 1); });
      if (count(items) > budget) {
        const ranked = items.map((it, i) => [it, i]).sort((a, b) => b[0].pr - a[0].pr || a[1] - b[1]).slice(0, budget).map((x) => x[1]).sort((a, b) => a - b);
        kept = ranked.map((i) => items[i]);
      }
    }
    const defs = [{ layout: 'cover', title: report.title, subtitle: report.subtitle }].concat(...kept.map((i) => i.defs), [END()]);
    return attach(deck, defs.map((d) => (d.block ? Object.assign({}, d, { block: { type: d.block.type, title: '', content: JSON.parse(JSON.stringify(d.block.content)) } }) : d)));
  }

  /* ---------- تحويل العرض إلى تقرير ---------- */
  function toReport(deck) {
    const r = T.createReport('blank');
    r.title = deck.title || ''; r.subtitle = deck.subtitle || ''; r.employee = deck.presenter || ''; r.palette = deck.palette || r.palette; r.date = deck.date || r.date;
    r.sections = [];
    deck.slides.forEach((s) => {
      if (s.layout !== 'content') return;
      const bl = (s.bullets || []).filter((b) => String(b).trim()), bs = blocksOf(deck, s).filter((b) => !R.isEmptySection(b));
      if (bl.length) { const l = T.makeSection('list', s.title, {}); l.content = { ordered: false, items: bl.slice() }; r.sections.push(l); }
      bs.forEach((b, i) => { const c = T.makeSection(b.type, b.title || (i === 0 ? s.title : ''), {}); c.content = JSON.parse(JSON.stringify(b.content)); c.icon = b.icon || ''; c.width = b.width === 'half' ? 'half' : 'full'; c.source = b.source || ''; c.asOf = b.asOf || ''; r.sections.push(c); });
    });
    if (!r.sections.length) r.sections.push(T.makeSection('text', 'المقدمة', {}));
    return r;
  }

  return { RATIOS, LAYOUTS, BGS, BLOCK_TYPES, TEMPLATES, newSlide, blockOf, blocksOf, idsOf, renderSlide, renderDeckPage, rootStyle, createDeck, fromReport, toReport, baseDeck };
});
