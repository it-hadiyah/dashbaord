// واجهات سير الاعتماد المشتركة: المشاركة مع المدير، الاعتماد/الإعادة، سجل الإجراءات
import { el, btn, modal, toast } from './ui.js';

export const STATUS = { draft: 'مسودة', submitted: 'بانتظار الاعتماد', approved: 'معتمد', returned: 'معاد للتعديل' };
const ACTIONS = { create: 'إنشاء التقرير', share: 'إرسال للاعتماد', withdraw: 'سحب من الاعتماد', approve: 'اعتماد', return: 'إعادة للتعديل', reopen: 'إعادة فتح', reassign: 'نقل الملكية' };

export async function call(id, act, body) {
  const res = await fetch('/api/reports/' + encodeURIComponent(id) + '/' + act, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'تعذر تنفيذ الإجراء');
  return out;
}

function form(title, fields, okLabel, run, danger) {
  return new Promise((resolve) => {
    let finished = false;
    const msg = el('p', { class: 'dlg-err', role: 'alert', style: 'color:var(--danger);min-height:1.2em;margin:8px 0 0' });
    const ok = btn(okLabel, { cls: danger ? 'danger' : 'primary' });
    const body = el('div', {}, fields, msg, el('div', { class: 'dlg-actions' }, ok, btn('إلغاء', { cls: 'ghost', onclick: () => m.close() })));
    const m = modal(title, body, { onclose: () => { if (!finished) resolve(false); } });
    ok.onclick = async () => {
      ok.disabled = true; msg.textContent = '';
      try { await run(); finished = true; m.close(); resolve(true); } catch (e) { msg.textContent = e.message; ok.disabled = false; }
    };
  });
}

export async function shareDialog(reportId) {
  const res = await fetch('/api/managers'); const data = res.ok ? await res.json() : { list: [], restricted: false }; const list = data.list;
  if (!list.length) { toast(data.restricted ? 'المعتمِد المحدد لك غير متاح حالياً. تواصل مع مسؤول النظام.' : 'لا يوجد مدراء مسجّلون. اطلب من مسؤول النظام إضافة مدير.', { tone: 'err', ms: 5000 }); return false; }
  const sel = el('select', { id: 'sh-mgr', 'aria-label': 'المدير' }, list.map((m) => el('option', { value: m.username, selected: m.isMine }, m.name + (m.department ? ' — ' + m.department : ''))));
  if (!list.some((m) => m.isMine)) sel.selectedIndex = 0;
  const note = el('textarea', { rows: 3, id: 'sh-note', placeholder: 'ملاحظة للمدير (اختياري)' });
  return form('إرسال التقرير للاعتماد', [
    el('p', { class: 'muted' }, (data.restricted ? 'المعتمِد المحدد لك من مسؤول النظام. ' : '') + 'بعد الإرسال يصل التقرير للمدير فقط ولا يمكنك تعديله حتى يعيده أو تسحبه. بدون الإرسال لا يوجد اعتماد.'),
    el('div', { class: 'fld' }, el('label', { for: 'sh-mgr' }, 'المدير المعتمِد'), sel), el('div', { class: 'fld' }, el('label', { for: 'sh-note' }, 'ملاحظة'), note)],
  'إرسال للاعتماد', async () => { await call(reportId, 'share', { manager: sel.value, note: note.value }); });
}

export function decideDialog(reportId, kind) {
  const approve = kind === 'approve';
  const note = el('textarea', { rows: 3, id: 'dc-note', placeholder: approve ? 'ملاحظة (اختياري)' : 'اكتب ما المطلوب تعديله' });
  return form(approve ? 'اعتماد التقرير' : 'إعادة التقرير للتعديل', [
    el('p', { class: 'muted' }, approve ? 'سيُختم التقرير بالاعتماد باسمك وتاريخ اليوم، ولن يمكن تعديله بعدها.' : 'سيعود التقرير لصاحبه مع ملاحظتك.'),
    el('div', { class: 'fld' }, el('label', { for: 'dc-note' }, approve ? 'ملاحظة' : 'سبب الإعادة *'), note)],
  approve ? 'اعتماد' : 'إعادة للتعديل', async () => { await call(reportId, approve ? 'approve' : 'return', { note: note.value }); }, !approve);
}

export async function simple(reportId, act, title, text, ok) {
  return form(title, [el('p', { class: 'muted' }, text)], ok, async () => { await call(reportId, act, {}); });
}

export function historyDialog(history) {
  const rows = (history || []).slice().reverse().map((h) => el('li', { style: 'padding:8px 0;border-bottom:1px solid var(--border)' }, el('b', {}, ACTIONS[h.action] || h.action), ' · ', h.byName || h.by, el('small', { class: 'muted', style: 'display:block' }, (h.at || '').replace('T', ' ').slice(0, 16) + (h.note ? ' — ' + h.note : ''))));
  modal('سجل التقرير', el('ul', { style: 'list-style:none;margin:0;padding:0;max-height:55vh;overflow:auto' }, rows.length ? rows : el('li', { class: 'muted' }, 'لا يوجد سجل.')));
}
