// محرر العروض التقديمية: شرائح مصغّرة + لوحة معاينة + خصائص الشريحة، مع تراجع/إعادة وحفظ تلقائي
import { el, btn, toast, confirmDialog, modal } from './ui.js';
import { store, load, edit, on, undo, redo, canUndo, canRedo } from './store.js';
import { sectionEditor, field, textInput, segmented } from './editors.js';
import { mountUserChip } from './userchip.js';

const D = window.RBD, T = window.RBT;
const $ = (id) => document.getElementById(id);
let cfg = {}, cur = 0, serverId = null, saveTimer = null, saving = false;

const deck = () => store.report;
const slideAt = (r, i) => r.slides[i];
const curSlide = () => deck().slides[cur];
const BLOCK_NAMES = { kpi: 'مؤشرات رئيسية', chart: 'رسم بياني', table: 'جدول', compare: 'مقارنة بين فترتين', calc: 'عملية حسابية', progress: 'نسب إنجاز', timeline: 'خط زمني', gantt: 'مخطط جانت', image: 'صورة', callout: 'ملاحظة', list: 'قائمة', text: 'نص' };

/* ---------- العرض ---------- */
function slideHtml(i) { const d = deck(); return D.renderSlide(d, d.slides[i], { config: cfg, preview: true, index: i, total: d.slides.length }); }

function renderStage() {
  const d = deck(), rt = D.RATIOS[d.ratio] || D.RATIOS['16:9'], host = $('dk-canvas');
  const avail = Math.max(300, host.clientWidth - 36), availH = Math.max(240, host.clientHeight - 70);
  const k = Math.min(avail / rt.w, availH / rt.h, 1.3);
  const st = $('dk-stage');
  st.setAttribute('style', `${D.rootStyle(d)};width:${rt.w * k}px;height:${rt.h * k}px`);
  st.innerHTML = slideHtml(cur);
  const s = st.querySelector('.slide'); if (s) s.style.transform = `scale(${k})`;
}

function renderThumbs() {
  const d = deck(), rt = D.RATIOS[d.ratio] || D.RATIOS['16:9'], W = 180, k = W / rt.w, box = $('dk-thumbs');
  const keep = box.scrollTop;
  box.replaceChildren(el('div', { class: 'dk-tools' },
    btn('+ شريحة', { cls: 'sm primary', onclick: addMenu }), btn('نسخ', { cls: 'sm ghost', onclick: dupSlide }), btn('حذف', { cls: 'sm ghost', onclick: delSlide }),
    btn('▲', { cls: 'sm ghost', title: 'تحريك لأعلى', onclick: () => moveSlide(cur, cur - 1) }), btn('▼', { cls: 'sm ghost', title: 'تحريك لأسفل', onclick: () => moveSlide(cur, cur + 1) })));
  d.slides.forEach((s, i) => {
    const t = el('div', { class: 'dk-th' + (i === cur ? ' on' : ''), draggable: 'true', tabindex: '0', role: 'button', 'aria-label': 'الشريحة ' + (i + 1) + ': ' + (s.title || D.LAYOUTS[s.layout].name), style: `${D.rootStyle(d)};width:${W}px;height:${rt.h * k}px`,
      onclick: () => select(i),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); } },
      ondragstart: (e) => { e.dataTransfer.setData('text/x-dk', String(i)); e.dataTransfer.effectAllowed = 'move'; },
      ondragover: (e) => { if ([...e.dataTransfer.types].includes('text/x-dk')) { e.preventDefault(); t.classList.add('over'); } },
      ondragleave: () => t.classList.remove('over'),
      ondrop: (e) => { e.preventDefault(); t.classList.remove('over'); const from = parseInt(e.dataTransfer.getData('text/x-dk'), 10); if (!isNaN(from)) moveSlide(from, i); } });
    t.append(el('span', { class: 'n' }, String(i + 1)));
    const inner = el('div', { class: 'in', html: slideHtml(i) }); inner.firstElementChild.style.transform = `scale(${k})`; inner.firstElementChild.style.position = 'absolute'; inner.firstElementChild.style.top = '0'; inner.firstElementChild.style.right = '0';
    t.append(inner); box.append(t);
  });
  box.scrollTop = keep;
}

/* ---------- لوحة الخصائص ---------- */
function slideField(id, fn, key) { edit((r) => { const s = r.slides.find((x) => x.id === id); if (s) fn(s); }, key + id, 'content'); }

function renderProps() {
  const d = deck(), s = curSlide(), box = $('dk-props');
  if (!s) { box.replaceChildren(); return; }
  const blk = D.blockOf(d, s);
  const content = s.layout === 'content';
  const parts = [
    el('h3', {}, 'الشريحة ' + (cur + 1) + ' من ' + d.slides.length),
    field('التخطيط', segmented(Object.entries(D.LAYOUTS).map(([k, v]) => [k, v.name]), s.layout, (v) => { edit((r) => { const x = r.slides.find((q) => q.id === s.id); x.layout = v; x.bg = D.LAYOUTS[v].bg; }, null, 'structure'); renderProps(); }, 'تخطيط الشريحة')),
    field('الخلفية', el('select', { 'aria-label': 'الخلفية', onchange: (e) => slideField(s.id, (x) => { x.bg = e.target.value; }, 'bg') }, Object.entries(D.BGS).map(([k, v]) => el('option', { value: k, selected: s.bg === k }, v)))),
    field(s.layout === 'cover' ? 'عنوان العرض' : 'عنوان الشريحة', textInput(s.title, (v) => slideField(s.id, (x) => { x.title = v; }, 't'), { ph: 'اكتب العنوان' })),
    field('عنوان فرعي (اختياري)', textInput(s.subtitle, (v) => slideField(s.id, (x) => { x.subtitle = v; }, 'sb'))),
  ];
  if (content) {
    parts.push(field('نقاط الشريحة (كل سطر نقطة)', el('textarea', { rows: 5, dir: 'auto', placeholder: 'اكتب نقطة في كل سطر', oninput: (e) => slideField(s.id, (x) => { x.bullets = e.target.value.split('\n').filter((l) => l.trim()); }, 'bl') }, (s.bullets || []).join('\n'))));
    parts.push(field('المحتوى (رسم، جدول، مؤشرات...)', el('select', { 'aria-label': 'نوع المحتوى', onchange: (e) => setBlock(e.target.value) }, el('option', { value: '' }, 'بدون'), D.BLOCK_TYPES.map((t) => el('option', { value: t, selected: blk && blk.type === t }, BLOCK_NAMES[t])))));
    if (blk) parts.push(el('div', { id: 'dk-block' }, sectionEditor(blk)));
  }
  parts.push(field('ملاحظات المقدّم (لا تظهر في الشريحة)', el('textarea', { rows: 3, dir: 'auto', oninput: (e) => slideField(s.id, (x) => { x.notes = e.target.value; }, 'nt') }, s.notes || '')));
  parts.push(el('details', { class: 'dk-meta' }, el('summary', {}, 'إعدادات العرض كله'),
    field('عنوان العرض', textInput(d.title, (v) => edit((r) => { r.title = v; }, 'dt', 'content'))),
    field('عنوان فرعي', textInput(d.subtitle, (v) => edit((r) => { r.subtitle = v; }, 'ds', 'content'))),
    field('المقدّم', textInput(d.presenter, (v) => edit((r) => { r.presenter = v; }, 'dp', 'content'))),
    field('التاريخ', textInput(d.date, (v) => edit((r) => { r.date = v; }, 'dd', 'content'), { type: 'date' })),
    field('مقاس الشرائح', segmented(Object.entries(D.RATIOS).map(([k, v]) => [k, v.name]), d.ratio, (v) => { edit((r) => { r.ratio = v; }, null, 'structure'); }, 'مقاس الشرائح')),
    field('لوحة الألوان', el('select', { 'aria-label': 'لوحة الألوان', onchange: (e) => edit((r) => { r.palette = e.target.value; }, null, 'structure') }, Object.entries(T.PALETTES).map(([k, v]) => el('option', { value: k, selected: d.palette === k }, v.name)))),
    field('نص التذييل', textInput(d.options.footerText, (v) => edit((r) => { r.options.footerText = v; }, 'df', 'content'))),
    el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: d.options.pageNumbers !== false, onchange: (e) => edit((r) => { r.options.pageNumbers = e.target.checked; }, null, 'structure') }), 'إظهار رقم الشريحة'),
    el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: !!d.options.arabicDigits, onchange: (e) => edit((r) => { r.options.arabicDigits = e.target.checked; }, null, 'structure') }), 'استخدام الأرقام العربية ٠١٢')));
  box.replaceChildren(...parts);
}

function setBlock(type) {
  const id = curSlide().id;
  edit((r) => {
    const s = r.slides.find((x) => x.id === id);
    if (s.blockId) r.sections = r.sections.filter((b) => b.id !== s.blockId);
    s.blockId = '';
    if (type) { const b = T.makeSection(type, '', {}); b.hint = ''; r.sections.push(b); s.blockId = b.id; }
  }, null, 'structure');
  renderProps();
}

/* ---------- عمليات الشرائح ---------- */
function select(i) { cur = Math.max(0, Math.min(deck().slides.length - 1, i)); renderThumbs(); renderStage(); renderProps(); }
function addSlide(layout) {
  edit((r) => { const s = D.newSlide(layout, { title: layout === 'content' ? '' : layout === 'closing' ? 'شكراً لكم' : '' }); r.slides.splice(cur + 1, 0, s); }, null, 'structure');
  select(cur + 1);
}
function addMenu(e) {
  const root = $('menu-root'); if (root.firstChild) { root.replaceChildren(); return; }
  const r = e.currentTarget.getBoundingClientRect();
  const item = (label, fn) => el('button', { type: 'button', role: 'menuitem', onclick: () => { root.replaceChildren(); fn(); } }, el('span', {}, label));
  const m = el('div', { class: 'menu', role: 'menu', style: `top:${r.bottom + 6}px;right:${Math.max(8, innerWidth - r.right)}px` },
    ...Object.entries(D.LAYOUTS).map(([k, v]) => item('شريحة ' + v.name, () => addSlide(k))),
    ...['kpi', 'chart', 'table', 'compare'].map((t) => item('شريحة: ' + BLOCK_NAMES[t], () => { addSlide('content'); setBlock(t); })));
  root.replaceChildren(m);
  const close = (ev) => { if (!m.contains(ev.target)) { root.replaceChildren(); document.removeEventListener('click', close, true); } };
  setTimeout(() => document.addEventListener('click', close, true), 0);
}
function dupSlide() {
  edit((r) => {
    const s = r.slides[cur], c = JSON.parse(JSON.stringify(s)); c.id = T.uid();
    const b = D.blockOf(r, s); if (b) { const nb = JSON.parse(JSON.stringify(b)); nb.id = T.uid(); r.sections.push(nb); c.blockId = nb.id; }
    r.slides.splice(cur + 1, 0, c);
  }, null, 'structure');
  select(cur + 1);
}
async function delSlide() {
  if (deck().slides.length <= 1) { toast('يجب أن يبقى شريحة واحدة على الأقل', { tone: 'err' }); return; }
  if (!(await confirmDialog({ title: 'حذف الشريحة', text: 'سيتم حذف الشريحة ' + (cur + 1) + '. يمكنك التراجع بـ Ctrl+Z.', ok: 'حذف', danger: true }))) return;
  edit((r) => { const s = r.slides[cur]; if (s.blockId) r.sections = r.sections.filter((b) => b.id !== s.blockId); r.slides.splice(cur, 1); }, null, 'structure');
  select(Math.min(cur, deck().slides.length - 1));
}
function moveSlide(from, to) {
  const n = deck().slides.length; if (to < 0 || to >= n || from === to) return;
  edit((r) => { r.slides.splice(to, 0, r.slides.splice(from, 1)[0]); }, null, 'structure');
  select(to);
}

/* ---------- الحفظ ---------- */
function status(t) { $('dk-status').textContent = t; }
async function save(quiet) {
  const d = deck();
  if (!String(d.title || '').trim()) { if (!quiet) toast('أدخل عنوان العرض من «إعدادات العرض كله»', { tone: 'err' }); return false; }
  if (saving) return false; saving = true; status('جارٍ الحفظ…');
  try {
    const res = await fetch('/api/decks/' + serverId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'تعذر الحفظ');
    store.dirty = false; status('تم الحفظ ' + new Date().toLocaleTimeString('ar-SA-u-ca-gregory', { hour: '2-digit', minute: '2-digit' }));
    if (!quiet) toast('تم حفظ العرض', { tone: 'ok' });
    return true;
  } catch (e) { status('تعذر الحفظ'); if (!quiet) toast(e.message, { tone: 'err' }); return false; } finally { saving = false; }
}
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => save(true), 2500); status('تغييرات غير محفوظة…'); }

/* ---------- التصدير والمشاركة ---------- */
async function ensureSaved() { if (store.dirty) return save(false); return true; }
function exportMenu(e) {
  const root = $('menu-root'); if (root.firstChild) { root.replaceChildren(); return; }
  const r = e.currentTarget.getBoundingClientRect();
  const item = (label, fn) => el('button', { type: 'button', role: 'menuitem', onclick: async () => { root.replaceChildren(); try { await fn(); } catch (err) { toast(err.message || 'تعذر التنفيذ', { tone: 'err' }); } } }, el('span', {}, label));
  const items = [
    item('عرض بملء الشاشة', async () => { if (await ensureSaved()) window.open('/decks/' + serverId + '.html#present', '_blank'); }),
    item('PDF / طباعة', async () => { if (await ensureSaved()) window.open('/decks/' + serverId + '.html#print', '_blank'); }),
    item('صفحة ويب HTML (تنزيل)', async () => { if (await ensureSaved()) location.href = '/api/decks/' + serverId + '/export.html'; }),
    item('PowerPoint ‏(PPTX)', async () => { const m = await import('./pptx.js'); await m.exportPptx(deck(), cfg); }),
    item('صور PNG لكل الشرائح', async () => { const m = await import('./pptx.js'); await m.exportPng(deck(), cfg, cur); }),
    item('رابط مشاركة', async () => { if (await ensureSaved()) { const m = await import('./share-ui.js'); m.openShareDialog({ type: 'deck', id: serverId, title: deck().title }); } }),
    item('تحويل إلى تقرير', async () => {
      const rep = D.toReport(deck());
      const res = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rep) });
      const out = await res.json().catch(() => ({})); if (!res.ok) throw new Error(out.error || 'تعذر الإنشاء');
      location.href = '/?edit=' + out.id;
    }),
  ];
  const menu = el('div', { class: 'menu', role: 'menu', style: `top:${r.bottom + 6}px;left:${Math.max(8, r.left)}px` }, ...items);
  root.replaceChildren(menu);
  const close = (ev) => { if (!menu.contains(ev.target)) { root.replaceChildren(); document.removeEventListener('click', close, true); } };
  setTimeout(() => document.addEventListener('click', close, true), 0);
}

/* ---------- التشغيل ---------- */
function full() { cur = Math.min(cur, deck().slides.length - 1); renderThumbs(); renderStage(); renderProps(); $('dk-name').textContent = deck().title || 'عرض بلا عنوان'; }
on((kind) => {
  $('b-undo').disabled = !canUndo(); $('b-redo').disabled = !canRedo();
  if (kind === 'all' || kind === 'select') { full(); }
  else { renderStage(); if (kind === 'structure') renderThumbs(); else { const t = $('dk-thumbs').querySelectorAll('.dk-th')[cur]; if (t) { const k = 180 / (D.RATIOS[deck().ratio] || D.RATIOS['16:9']).w, inner = t.querySelector('.in'); inner.innerHTML = slideHtml(cur); const sl = inner.firstElementChild; sl.style.transform = `scale(${k})`; sl.style.position = 'absolute'; sl.style.top = '0'; sl.style.right = '0'; } } $('dk-name').textContent = deck().title || 'عرض بلا عنوان'; }
  if (kind !== 'status' && store.dirty) scheduleSave();
});

$('b-undo').onclick = () => undo(); $('b-redo').onclick = () => redo();
$('b-save').onclick = () => save(false);
$('b-export').onclick = exportMenu;
$('b-present').onclick = async () => { if (await ensureSaved()) window.open('/decks/' + serverId + '.html#present', '_blank'); };
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(false); }
  else if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  else if (!typing && e.key === 'ArrowDown') { e.preventDefault(); select(cur + 1); }
  else if (!typing && e.key === 'ArrowUp') { e.preventDefault(); select(cur - 1); }
});
addEventListener('resize', () => renderStage());
addEventListener('beforeunload', (e) => { if (store.dirty) { e.preventDefault(); e.returnValue = ''; } });

(async () => {
  const me = await (await fetch('/api/me')).json();
  store.user = me.username; mountUserChip($('user-chip'), me);
  cfg = await (await fetch('/api/config')).json();
  serverId = new URLSearchParams(location.search).get('id');
  if (!serverId) { location.href = '/decks.html'; return; }
  const res = await fetch('/api/decks/' + serverId);
  if (!res.ok) { toast('تعذر فتح العرض', { tone: 'err' }); setTimeout(() => (location.href = '/decks.html'), 1200); return; }
  const d = await res.json(); delete d.access;
  load(d, { serverId });
  store.dirty = false; status('');
})();
