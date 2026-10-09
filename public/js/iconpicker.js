// منتقي أيقونات الهوية: نافذة بشبكة أيقونات مع بحث
import { el, btn, modal } from './ui.js';

let cache;
export async function loadIcons() {
  if (!cache) { try { cache = await (await fetch('/brand/icons/index.json')).json(); } catch (e) { cache = []; } }
  return cache;
}
export const iconSrc = (slug, v = 'hex') => (slug ? `/brand/icons/${v}/${slug}.svg` : '');

export async function pickIcon({ current = '', variant = 'hex', title = 'اختر أيقونة', allowNone = true } = {}) {
  const icons = (await loadIcons()).filter((i) => i[variant]);
  return new Promise((resolve) => {
    let done = false;
    const grid = el('div', { class: 'icon-grid', role: 'listbox', 'aria-label': 'أيقونات الهوية' });
    const finish = (v) => { if (done) return; done = true; m.close(); resolve(v); };
    const draw = (q) => {
      grid.replaceChildren(...icons.filter((i) => !q || i.label.includes(q)).map((i) => el('button', { type: 'button', role: 'option', class: 'icon-opt' + (i.id === current ? ' on' : ''), 'aria-selected': String(i.id === current), title: i.label, onclick: () => finish(i.id) },
      el('img', { src: iconSrc(i.id, variant), alt: '' }), el('span', {}, i.label))));
      if (!grid.children.length) grid.append(el('p', { class: 'muted' }, 'لا توجد أيقونات مطابقة.'));
    };
    const search = el('input', { type: 'search', placeholder: 'ابحث عن أيقونة...', 'aria-label': 'ابحث عن أيقونة', oninput: (e) => draw(e.target.value.trim()) });
    const body = el('div', {}, search, grid, allowNone ? el('div', { class: 'btns' }, btn('بدون أيقونة', { cls: 'ghost sm', onclick: () => finish('') })) : null);
    const m = modal(title, body, { onclose: () => { if (!done) { done = true; resolve(null); } } });
    draw(''); search.focus();
  });
}

/* زر معاينة الأيقونة الحالية (يفتح المنتقي) */
export function iconButton(current, onChange, o = {}) {
  const b = el('button', { type: 'button', class: 'icon-btn' + (current ? ' has' : ''), title: o.title || 'اختيار أيقونة', 'aria-label': o.title || 'اختيار أيقونة' });
  const paint = (v) => { b.replaceChildren(v ? el('img', { src: iconSrc(v, o.variant || 'hex'), alt: '' }) : el('span', { class: 'plus' }, '+')); b.classList.toggle('has', !!v); };
  paint(current);
  b.onclick = async () => { const v = await pickIcon({ current, variant: o.variant || 'hex', title: o.dialogTitle }); if (v === null) return; current = v; paint(v); onChange(v); };
  return b;
}
