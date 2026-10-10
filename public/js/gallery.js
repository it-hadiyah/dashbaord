// معرض القوالب: بطاقات بمعاينة مصغّرة حقيقية لكل قالب، مع بحث وتصنيف
import { el, btn, $ } from './ui.js';
import { icon } from './icons.js';
import * as T from './templates.js';
import { renderPayload, config } from './preview.js';
import { store } from './store.js';

const favKey = () => 'rb-fav:' + (store.user || '');
const readFavs = () => { try { return new Set(JSON.parse(localStorage.getItem(favKey()) || '[]')); } catch (e) { return new Set(); } };
const writeFavs = (set) => { try { localStorage.setItem(favKey(), JSON.stringify(Array.from(set))); } catch (e) { /* ignore */ } };

const thumbs = new Map(); // contentWindow -> { tpl, page }
let msgBound = false;

function bindMessages() {
  if (msgBound) return; msgBound = true;
  window.addEventListener('message', (e) => {
    const t = thumbs.get(e.source);
    if (!t || !e.data || e.data.type !== 'ready') return;
    const report = T.createReport(t.tpl.id, { sample: true });
    report.employee = 'اسم الموظف'; report.department = 'اسم الإدارة';
    e.source.postMessage(Object.assign(renderPayload(report, { preview: false }), { zoom: 1 }), '*');
    setTimeout(() => { t.card.classList.add('loaded'); gotoThumb(t); }, 450);
  });
}

const contentPage = (tpl) => 2 + (tpl.toc ? 1 : 0);
function gotoThumb(t) { t.frame.contentWindow.postMessage({ type: 'goto', page: t.page === 'cover' ? 1 : contentPage(t.tpl), instant: true }, '*'); }

function fitThumb(card) {
  const wrap = card.querySelector('.thumb'); const f = card.querySelector('iframe'); if (!f) return;
  f.style.transform = `scale(${wrap.clientWidth / 794})`;
}

function card(tpl, onUse, isFav, onFav) {
  const c = el('article', { class: 'tcard', 'data-cat': tpl.category });
  const wrap = el('div', { class: 'thumb', 'aria-hidden': 'true' }, el('div', { class: 'skel' }));
  const pal = T.PALETTES[tpl.palette];
  const toggle = el('div', { class: 'thumb-tabs', role: 'group', 'aria-label': 'معاينة القالب' },
    ['cover', 'content'].map((k) => el('button', { type: 'button', class: k === 'cover' ? 'on' : '', 'aria-pressed': String(k === 'cover'), onclick: (e) => {
      const t = thumbs.get(c.querySelector('iframe') && c.querySelector('iframe').contentWindow); if (!t) return;
      t.page = k; gotoThumb(t); toggle.querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b === e.currentTarget); b.setAttribute('aria-pressed', String(b === e.currentTarget)); });
    } }, k === 'cover' ? 'الغلاف' : 'المحتوى')));
  c.append(wrap, toggle,
    el('div', { class: 'tinfo' },
      el('div', { class: 'tmeta' }, el('span', { class: 'tag' }, tpl.category), (() => { const b = el('button', { type: 'button', class: 'fav', 'aria-pressed': String(isFav), title: 'تثبيت في المفضلة', 'aria-label': 'تثبيت ' + tpl.name + ' في المفضلة', onclick: () => { const on = onFav(tpl.id); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '★' : '☆'; } }, isFav ? '★' : '☆'); return b; })(), el('span', { class: 'dots' }, el('i', { style: `background:${pal.a}` }), el('i', { style: `background:${pal.x}` }))),
      el('h3', {}, tpl.name), el('p', {}, tpl.desc),
      el('div', { class: 'tact' }, btn('استخدم القالب', { cls: 'primary', onclick: () => onUse(tpl, false) }), btn('ببيانات تجريبية', { cls: 'ghost', icon: 'sparkle', title: 'يملأ القالب ببيانات توضيحية لتجربة الشكل', onclick: () => onUse(tpl, true) }))));
  // تحميل المعاينة عند ظهور البطاقة فقط
  const io = new IntersectionObserver((ents) => {
    if (!ents[0].isIntersecting) return; io.disconnect();
    const f = el('iframe', { src: '/preview.html?thumb=1', title: 'معاينة ' + tpl.name, tabindex: '-1', loading: 'lazy', scrolling: 'no' });
    wrap.append(f); thumbs.set(f.contentWindow, null);
    f.addEventListener('load', () => { thumbs.set(f.contentWindow, { tpl, frame: f, card: c, page: 'cover' }); fitThumb(c); });
    thumbs.set(f.contentWindow, { tpl, frame: f, card: c, page: 'cover' });
  }, { rootMargin: '300px' });
  io.observe(c);
  new ResizeObserver(() => fitThumb(c)).observe(wrap);
  return c;
}

export function buildGallery(root, onUse, allowed, onCustom) {
  bindMessages();
  let cat = 'الكل', q = '';
  const grid = el('div', { class: 'tgrid' });
  const chips = el('div', { class: 'chips', role: 'tablist', 'aria-label': 'تصنيف القوالب' });
  const empty = el('div', { class: 'empty', hidden: true }, el('span', { html: icon('search', 32) }), el('b', {}, 'لا توجد قوالب مطابقة'), el('small', {}, 'جرّب كلمة بحث أخرى أو اختر تصنيف «الكل».'));
  const list = T.TEMPLATES.filter((t) => !Array.isArray(allowed) || allowed.includes(t.id));
  const favs = readFavs();
  const toggleFav = (id) => { if (favs.has(id)) favs.delete(id); else favs.add(id); writeFavs(favs); order(); apply(); return favs.has(id); };
  const cards = list.map((t) => ({ t, el: card(t, onUse, favs.has(t.id), toggleFav) }));
  const order = () => [...cards].sort((a, b) => (favs.has(b.t.id) ? 1 : 0) - (favs.has(a.t.id) ? 1 : 0)).forEach((c) => grid.append(c.el));
  order();
  const apply = () => {
    let n = 0;
    cards.forEach(({ t, el: e }) => { const ok = (cat === 'الكل' || (cat === '★' ? favs.has(t.id) : t.category === cat)) && (!q || (t.name + ' ' + t.desc + ' ' + t.category).includes(q)); e.hidden = !ok; if (ok) n++; });
    empty.hidden = n > 0;
  };
  const usedCats = new Set(list.map((t) => t.category));
  ['الكل', '★'].concat(T.CATEGORIES.filter((c) => c !== 'الكل' && usedCats.has(c))).forEach((c) => chips.append(el('button', { type: 'button', role: 'tab', class: 'chip' + (c === cat ? ' on' : ''), 'aria-selected': String(c === cat), onclick: (e) => { cat = c; chips.querySelectorAll('.chip').forEach((b) => { b.classList.toggle('on', b === e.currentTarget); b.setAttribute('aria-selected', String(b === e.currentTarget)); }); apply(); } }, c === '★' ? '★ المفضلة' : c)));
  const search = el('div', { class: 'search' }, el('span', { html: icon('search', 16) }), el('input', { type: 'search', placeholder: 'ابحث في القوالب...', 'aria-label': 'ابحث في القوالب', oninput: (e) => { q = e.target.value.trim(); apply(); } }));
  if (!list.length) { root.replaceChildren(el('div', { class: 'empty' }, el('span', { html: icon('folder', 32) }), el('b', {}, 'لا توجد أنواع تقارير مسموحة لحسابك'), el('small', {}, 'تواصل مع مسؤول النظام ليحدد لك أنواع التقارير.'))); return; }
  const mine = el('div', { class: 'cust', hidden: true });
  if (onCustom) fetch('/api/custom-templates').then((r) => (r.ok ? r.json() : [])).then((rows) => {
    if (!rows.length) return; mine.hidden = false;
    mine.replaceChildren(el('h2', { style: 'margin:8px 0' }, 'القوالب الرسمية وقوالبي'), el('div', { class: 'tgrid' }, rows.map((t) => el('article', { class: 'tcard', style: 'padding:16px;gap:6px' },
      el('div', { class: 'tmeta' }, el('span', { class: 'tag' }, t.official ? 'قالب رسمي' : t.shared ? 'مشترك' : 'قالبي'), el('span', { class: 'muted', style: 'font-size:12px' }, t.sections + ' قسم')),
      el('h3', { style: 'margin:4px 0' }, t.name), el('p', { class: 'muted' }, t.desc || (t.ownerName ? 'بواسطة ' + t.ownerName : '')),
      el('div', { class: 'tact' }, btn('استخدم القالب', { cls: 'primary', onclick: () => onCustom(t) }), t.mine || store.role === 'admin' ? btn('حذف', { cls: 'ghost', onclick: async () => { if (!confirm('حذف القالب «' + t.name + '»؟')) return; const d = await fetch('/api/custom-templates/' + t.id, { method: 'DELETE' }); if (d.ok) { rows.splice(rows.indexOf(t), 1); buildGallery(root, onUse, allowed, onCustom); } } }) : null)))));
  }).catch(() => {});
  root.replaceChildren(el('div', { class: 'gal-tools' }, search, chips), mine, grid, empty);
}
