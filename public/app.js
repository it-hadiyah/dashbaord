// معالج إنشاء التقرير: اختيار نموذج ثم تعبئة كل قسم بخطوة مستقلة مع معاينة مباشرة
const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else if (k === 'value') e.value = v; else e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) e.append(kid.nodeType ? kid : document.createTextNode(kid));
  return e;
};

const S = (type, title, hint, extra = {}) => ({ type, title, hint, ...extra });
const TEMPLATES = [
  { name: 'تقرير عام', icon: '📄', desc: 'تقرير بسيط بمقدمة وتفاصيل وخلاصة.', sections: [
    S('text', 'المقدمة', 'اكتب مقدمة قصيرة: ما موضوع التقرير ولماذا كُتب؟'),
    S('text', 'التفاصيل', 'اشرح التفاصيل الرئيسية للموضوع.'),
    S('text', 'الخلاصة والتوصيات', 'ما الخلاصة؟ وما الذي توصي به؟')] },
  { name: 'تقرير مشروع', icon: '🗂️', desc: 'عن مشروع كنت مسؤولاً عنه: مؤشراته ومهامه ومخاطره.', sections: [
    S('text', 'نبذة عن المشروع', 'ما هو المشروع؟ وما هدفه والجهة المستفيدة؟'),
    S('kpi', 'مؤشرات المشروع', 'أدخل أهم الأرقام، مثل الحالة ونسبة الإنجاز والميزانية. التغيّر اختياري (مثل 5% أو -3%).', { preset: ['الحالة', 'نسبة الإنجاز', 'الميزانية'] }),
    S('table', 'المهام', 'سجّل مهام المشروع ومن المسؤول عن كل مهمة وحالتها.', { preset: ['المهمة', 'المسؤول', 'الحالة', 'نسبة الإنجاز'] }),
    S('text', 'المخاطر والعوائق', 'ما العوائق التي واجهتها أو قد تواجهها؟'),
    S('text', 'الخطوات القادمة', 'ما الذي سيتم عمله في المرحلة التالية؟')] },
  { name: 'تقرير إنجازات ومهام', icon: '✅', desc: 'المهام التي أنجزتها خلال فترة معينة.', sections: [
    S('list', 'المهام المنجزة', 'اكتب كل مهمة أنجزتها في سطر مستقل.'),
    S('list', 'مهام قيد التنفيذ', 'ما المهام التي ما زالت تعمل عليها؟'),
    S('text', 'التحديات', 'ما التحديات التي واجهتك؟'),
    S('text', 'ملاحظات', 'أي ملاحظات إضافية تود ذكرها.')] },
  { name: 'تقرير للمدير', icon: '👔', desc: 'ملخص تنفيذي مختصر لعرضه على المدير.', sections: [
    S('text', 'ملخص تنفيذي', 'لخّص الموضوع في فقرة واحدة واضحة.'),
    S('list', 'أبرز النقاط', 'اذكر أهم النقاط التي يجب أن ينتبه لها المدير.'),
    S('text', 'المطلوب من الإدارة', 'ما القرار أو الدعم الذي تحتاجه؟')] },
  { name: 'اجتماع الإدارات', icon: '🤝', desc: 'محضر أو ملخص اجتماع بين الإدارات.', sections: [
    S('kpi', 'بيانات الاجتماع', 'أدخل بيانات الاجتماع: التاريخ والمكان وعدد الحضور.', { preset: ['التاريخ', 'المكان', 'عدد الحضور'] }),
    S('list', 'الحضور', 'اكتب اسم كل حاضر في سطر.'),
    S('list', 'جدول الأعمال', 'ما البنود التي نوقشت؟'),
    S('text', 'ملخص النقاش', 'لخّص أهم ما دار في الاجتماع.'),
    S('table', 'القرارات والتوصيات', 'سجّل كل قرار ومن المسؤول عن تنفيذه وموعده.', { preset: ['القرار', 'المسؤول', 'الموعد'] })] },
  { name: 'لوحة مؤشرات', icon: '📊', desc: 'أرقام ورسوم بيانية مثل لوحة المتابعة.', sections: [
    S('kpi', 'نظرة عامة', 'أدخل أهم الأرقام مع نسبة تغيّرها.', { preset: ['المؤشر الأول', 'المؤشر الثاني', 'المؤشر الثالث'] }),
    S('chart', 'الرسم الأول', 'اختر نوع الرسم وأدخل التسميات وقيمها.', { width: 'half', kind: 'bar' }),
    S('chart', 'الرسم الثاني', 'اختر نوع الرسم وأدخل التسميات وقيمها.', { width: 'half', kind: 'donut' }),
    S('table', 'التفاصيل', 'أضف جدولاً بالتفاصيل إن لزم.', { preset: ['البند', 'القيمة', 'الملاحظات'] })] },
  { name: 'تقرير فارغ', icon: '✏️', desc: 'ابدأ من الصفر وأضف الأقسام التي تريدها.', sections: [] },
];

const TYPE_NAMES = { text: 'نص', list: 'قائمة نقاط', table: 'جدول', kpi: 'أرقام ومؤشرات', chart: 'رسم بياني' };
const KINDS = { bar: 'أعمدة', line: 'خط', donut: 'دائري', hbar: 'أعمدة أفقية' };
const ADD_HINTS = {
  text: 'اكتب النص الذي تريده في هذا القسم.', list: 'اكتب كل نقطة في سطر مستقل.',
  table: 'عرّف الأعمدة ثم عبّي الصفوف.', kpi: 'أدخل الأرقام المهمة مع تسمية كل رقم.', chart: 'اختر نوع الرسم وأدخل التسميات وقيمها.',
};

let state, cur = 0, previewTimer;

function newSection(type, title = '', hint = '', o = {}) {
  let content;
  if (type === 'text') content = '';
  else if (type === 'list') content = [''];
  else if (type === 'kpi') content = (o.preset || ['', '', '']).map((label) => ({ label, value: '', trend: '' }));
  else if (type === 'table') { const n = (o.preset || ['', '', '']).length; content = { headers: [...(o.preset || ['', '', ''])], rows: [Array(n).fill(''), Array(n).fill('')] }; }
  else content = { kind: o.kind || 'bar', data: [{ label: '', value: '' }, { label: '', value: '' }, { label: '', value: '' }] };
  return { type, title, hint: hint || ADD_HINTS[type], width: o.width || 'full', content, skipped: false };
}

// ---------- المعرض ----------
function buildGallery() {
  const box = $('cards');
  TEMPLATES.forEach((t) => {
    box.append(el('button', { type: 'button', class: 'card-tpl', onclick: () => start(t) },
      el('div', { class: 'ico' }, t.icon), el('strong', {}, t.name), el('p', {}, t.desc),
      el('ul', {}, t.sections.slice(0, 5).map((s) => el('li', {}, s.title)))));
  });
}

function start(t) {
  state = {
    tpl: t.name,
    meta: { title: '', employee: '', department: '', date: new Date().toISOString().slice(0, 10) },
    sections: t.sections.map((s) => newSection(s.type, s.title, s.hint, s)),
  };
  cur = 0;
  $('gallery').hidden = true; $('wizard').hidden = false;
  go(0);
}
$('back-gallery').onclick = () => { if (confirm('العودة لاختيار النموذج؟ ستفقد ما كتبته.')) { $('wizard').hidden = true; $('gallery').hidden = false; } };

// ---------- الخطوات ----------
const lastStep = () => state.sections.length + 1; // 0: البيانات الأساسية، 1..n: الأقسام، n+1: المراجعة
const sectionAt = (step) => state.sections[step - 1];

function go(step) {
  cur = step;
  $('msg').textContent = '';
  renderDots();
  const ed = $('editor');
  ed.replaceChildren();
  $('prev').hidden = step === 0;
  $('skip').hidden = step === 0 || step === lastStep();
  $('next').textContent = step === lastStep() ? 'إرسال وإنشاء التقرير' : 'التالي';

  if (step === 0) {
    $('step-count').textContent = `الخطوة 1 من ${lastStep() + 1}`;
    $('step-title').textContent = 'بيانات التقرير';
    $('step-hint').textContent = 'ابدأ بالبيانات الأساسية التي تظهر في أعلى التقرير.';
    ed.append(field('عنوان التقرير *', 'title'), field('اسم الموظف *', 'employee'), field('القسم / الإدارة', 'department'), field('التاريخ', 'date', 'date'));
  } else if (step === lastStep()) {
    $('step-count').textContent = `الخطوة ${step + 1} من ${lastStep() + 1}`;
    $('step-title').textContent = 'المراجعة والإرسال';
    $('step-hint').textContent = 'راجع الأقسام، وأضف أقساماً أخرى إن أردت، ثم اضغط إرسال.';
    renderReview(ed);
  } else {
    const s = sectionAt(step);
    $('step-count').textContent = `الخطوة ${step + 1} من ${lastStep() + 1} · ${TYPE_NAMES[s.type]}`;
    $('step-title').textContent = s.title || 'قسم جديد';
    $('step-hint').textContent = s.hint;
    ed.append(el('label', { class: 'fld' }, 'عنوان القسم', el('input', { value: s.title, oninput: (e) => { s.title = e.target.value; $('step-title').textContent = s.title || 'قسم جديد'; refresh(); } })));
    ed.append(editorFor(s));
    ed.append(el('label', { class: 'fld inline' }, 'عرض القسم في التقرير',
      el('select', { onchange: (e) => { s.width = e.target.value; refresh(); } }, el('option', { value: 'full' }, 'عرض كامل'), el('option', { value: 'half' }, 'نصف العرض (بجانب قسم آخر)'))));
    ed.querySelector('select').value = s.width;
  }
  refresh(0);
}

function field(label, key, type = 'text') {
  return el('label', { class: 'fld' }, label, el('input', { type, value: state.meta[key], oninput: (e) => { state.meta[key] = e.target.value; refresh(); } }));
}

function renderDots() {
  const d = $('dots');
  d.replaceChildren();
  for (let i = 0; i <= lastStep(); i++) {
    const s = i > 0 && i < lastStep() ? sectionAt(i) : null;
    const label = i === 0 ? 'البيانات' : i === lastStep() ? 'المراجعة' : s.title || 'قسم';
    d.append(el('button', { type: 'button', class: 'dot' + (i === cur ? ' on' : '') + (s && s.skipped ? ' skipped' : ''), title: label, onclick: () => go(i) }, String(i + 1)));
  }
}

// ---------- المحررات ----------
function editorFor(s) {
  if (s.type === 'text') return el('textarea', { rows: 8, oninput: (e) => { s.content = e.target.value; refresh(); } }, '');
  if (s.type === 'list') return listEditor(s);
  if (s.type === 'kpi') return kpiEditor(s);
  if (s.type === 'table') return tableEditor(s);
  return chartEditor(s);
}

function listEditor(s) {
  const wrap = el('div', { class: 'rows' });
  const draw = (focus) => {
    wrap.replaceChildren();
    s.content.forEach((v, i) => {
      const inp = el('input', { value: v, placeholder: `النقطة ${i + 1}`, oninput: (e) => { s.content[i] = e.target.value; refresh(); },
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); s.content.splice(i + 1, 0, ''); draw(i + 1); } } });
      wrap.append(el('div', { class: 'row' }, inp, el('button', { type: 'button', class: 'x', onclick: () => { s.content.splice(i, 1); if (!s.content.length) s.content.push(''); draw(); refresh(); } }, '×')));
    });
    wrap.append(el('button', { type: 'button', class: 'ghost small', onclick: () => { s.content.push(''); draw(s.content.length - 1); } }, '+ نقطة'));
    if (focus != null) wrap.querySelectorAll('input')[focus].focus();
  };
  draw();
  return wrap;
}

function kpiEditor(s) {
  const wrap = el('div', { class: 'rows' });
  const draw = () => {
    wrap.replaceChildren(el('div', { class: 'row head' }, el('span', {}, 'التسمية'), el('span', {}, 'القيمة'), el('span', {}, 'التغيّر (اختياري)'), el('span')));
    s.content.forEach((k, i) => {
      wrap.append(el('div', { class: 'row kpi' },
        el('input', { value: k.label, placeholder: 'مثال: عدد المستفيدين', oninput: (e) => { k.label = e.target.value; refresh(); } }),
        el('input', { value: k.value, placeholder: 'مثال: 3,123', oninput: (e) => { k.value = e.target.value; refresh(); } }),
        el('input', { value: k.trend, placeholder: '4% أو -7%', oninput: (e) => { k.trend = e.target.value; refresh(); } }),
        el('button', { type: 'button', class: 'x', onclick: () => { s.content.splice(i, 1); draw(); refresh(); } }, '×')));
    });
    wrap.append(el('button', { type: 'button', class: 'ghost small', onclick: () => { s.content.push({ label: '', value: '', trend: '' }); draw(); } }, '+ مؤشر'));
  };
  draw();
  return wrap;
}

function tableEditor(s) {
  const wrap = el('div', { class: 'tablewrap-ed' });
  const draw = () => {
    const c = s.content;
    const t = el('table', { class: 'grid' });
    t.append(el('tr', {}, c.headers.map((h, j) => el('th', {},
      el('input', { value: h, placeholder: `العمود ${j + 1}`, oninput: (e) => { c.headers[j] = e.target.value; refresh(); } }),
      c.headers.length > 1 ? el('button', { type: 'button', class: 'x', title: 'حذف العمود', onclick: () => { c.headers.splice(j, 1); c.rows.forEach((r) => r.splice(j, 1)); draw(); refresh(); } }, '×') : null)), el('th', {})));
    c.rows.forEach((r, i) => t.append(el('tr', {}, r.map((v, j) => el('td', {}, el('input', { value: v, oninput: (e) => { r[j] = e.target.value; refresh(); } }))),
      el('td', {}, el('button', { type: 'button', class: 'x', title: 'حذف الصف', onclick: () => { c.rows.splice(i, 1); draw(); refresh(); } }, '×')))));
    wrap.replaceChildren(t,
      el('div', { class: 'btns' },
        el('button', { type: 'button', class: 'ghost small', onclick: () => { c.rows.push(Array(c.headers.length).fill('')); draw(); } }, '+ صف'),
        el('button', { type: 'button', class: 'ghost small', onclick: () => { c.headers.push(''); c.rows.forEach((r) => r.push('')); draw(); } }, '+ عمود')),
      el('p', { class: 'tip' }, 'يمكنك لصق جدول منسوخ من Excel في الخلية الأولى وسيتوزع تلقائياً.'));
    const first = t.querySelector('td input');
    if (first) first.addEventListener('paste', (e) => {
      const txt = (e.clipboardData || window.clipboardData).getData('text');
      if (!/\t|\n/.test(txt)) return;
      e.preventDefault();
      const rows = txt.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split('\t').map((x) => x.trim()));
      const n = Math.max(...rows.map((r) => r.length), c.headers.length);
      while (c.headers.length < n) c.headers.push('');
      c.rows = rows.map((r) => { const row = r.slice(); while (row.length < n) row.push(''); return row; });
      draw(); refresh();
    });
  };
  draw();
  return wrap;
}

function chartEditor(s) {
  const wrap = el('div', {});
  const draw = () => {
    const c = s.content;
    wrap.replaceChildren(
      el('div', { class: 'kinds' }, Object.entries(KINDS).map(([k, name]) => el('button', { type: 'button', class: 'kind' + (c.kind === k ? ' on' : ''), onclick: () => { c.kind = k; draw(); refresh(); } }, name))),
      el('div', { class: 'rows' },
        el('div', { class: 'row head two' }, el('span', {}, 'التسمية'), el('span', {}, 'القيمة (رقم)'), el('span')),
        c.data.map((d, i) => el('div', { class: 'row two' },
          el('input', { value: d.label, placeholder: 'مثال: الأحد', oninput: (e) => { d.label = e.target.value; refresh(); } }),
          el('input', { value: d.value, inputmode: 'decimal', placeholder: 'مثال: 18', oninput: (e) => { d.value = e.target.value; refresh(); } }),
          el('button', { type: 'button', class: 'x', onclick: () => { c.data.splice(i, 1); draw(); refresh(); } }, '×'))),
        el('button', { type: 'button', class: 'ghost small', onclick: () => { c.data.push({ label: '', value: '' }); draw(); } }, '+ صف')));
  };
  draw();
  return wrap;
}

// ---------- المراجعة ----------
const filled = (s) => {
  const c = s.content;
  if (s.type === 'text') return !!c.trim();
  if (s.type === 'list') return c.some((i) => i.trim());
  if (s.type === 'kpi') return c.some((k) => k.label || k.value);
  if (s.type === 'table') return c.rows.some((r) => r.some((x) => x.trim()));
  return c.data.some((d) => d.label || d.value);
};

function renderReview(ed) {
  const list = el('ul', { class: 'review' });
  state.sections.forEach((s, i) => {
    const ok = filled(s) && !s.skipped;
    list.append(el('li', { class: ok ? 'ok' : 'empty' },
      el('span', {}, (ok ? '✔ ' : '○ ') + (s.title || 'قسم بدون عنوان') + (ok ? '' : ' — فارغ (لن يظهر في التقرير)')),
      el('button', { type: 'button', class: 'ghost small', onclick: () => go(i + 1) }, 'تعديل'),
      el('button', { type: 'button', class: 'ghost small', onclick: () => { state.sections.splice(i, 1); go(lastStep()); } }, 'حذف')));
  });
  ed.append(list, el('div', { class: 'addrow' }, el('span', {}, 'إضافة قسم جديد:'),
    Object.entries(TYPE_NAMES).map(([type, name]) => el('button', { type: 'button', class: 'ghost small', onclick: () => { state.sections.push(newSection(type, '')); go(state.sections.length); } }, name))));
}

// ---------- المعاينة ----------
function normalized() {
  const sections = state.sections.filter((s) => !s.skipped).map((s) => {
    let content = s.content;
    if (s.type === 'list') content = content.filter((i) => i.trim());
    else if (s.type === 'kpi') content = content.filter((k) => k.label || k.value);
    else if (s.type === 'table') content = { headers: content.headers, rows: content.rows.filter((r) => r.some((x) => x.trim())) };
    else if (s.type === 'chart') content = { kind: content.kind, data: content.data.filter((d) => d.label || d.value) };
    return { type: s.type, title: s.title, width: s.width, content, _src: s };
  });
  return sections;
}

function payload() {
  const secs = normalized();
  const active = cur > 0 && cur < lastStep() ? secs.findIndex((s) => s._src === sectionAt(cur)) : -1;
  return { ...state.meta, type: state.tpl, sections: secs.map(({ _src, ...s }) => s), highlight: active };
}

function refresh(delay = 350) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    try {
      const res = await fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
      $('preview').srcdoc = await res.text();
    } catch (e) { /* المعاينة اختيارية */ }
  }, delay);
}

// ---------- التنقل والإرسال ----------
$('prev').onclick = () => go(cur - 1);
$('skip').onclick = () => { const s = sectionAt(cur); s.skipped = true; go(cur + 1); };
$('next').onclick = async () => {
  if (cur === 0 && (!state.meta.title.trim() || !state.meta.employee.trim())) { $('msg').textContent = 'عنوان التقرير واسم الموظف مطلوبان.'; return; }
  if (cur > 0 && cur < lastStep()) sectionAt(cur).skipped = false;
  if (cur < lastStep()) return go(cur + 1);
  $('msg').textContent = 'جاري إنشاء التقرير...';
  try {
    const p = payload(); delete p.highlight;
    const res = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error);
    location.href = out.url;
  } catch (err) { $('msg').textContent = 'تعذر إنشاء التقرير: ' + err.message; }
};

buildGallery();
