// شريط إجراءات صفحة التقرير المحفوظ: الحالة، التعديل، المشاركة مع المدير، الاعتماد، السجل
import { el, btn } from './ui.js';
import { STATUS, shareDialog, decideDialog, simple, historyDialog } from './workflow-ui.js';

const rid = document.body.dataset.rid;
const box = document.getElementById('vb-actions');
if (rid && box) {
  fetch('/api/reports/' + encodeURIComponent(rid)).then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d) return;
    const a = d.access, w = d.workflow || { status: 'draft' };
    const chip = document.getElementById('vb-status');
    chip.textContent = STATUS[w.status] || ''; chip.className = 'chip-status ' + w.status;
    const who = document.createElement('span'); who.className = 'muted'; who.style.fontSize = '13px';
    who.textContent = (d.ownerName ? 'صاحب التقرير: ' + d.ownerName : '') + (w.sharedWithName && w.status !== 'draft' ? ' · عند: ' + w.sharedWithName : '');
    chip.after(who);
    const reload = () => location.reload();
    const items = [];
    if (a.edit) items.push(el('a', { class: 'btn', href: '/?edit=' + encodeURIComponent(rid) }, 'تعديل'));
    if (a.share) items.push(btn('إرسال للاعتماد', { cls: 'primary', onclick: async () => { if (await shareDialog(rid)) reload(); } }));
    if (a.withdraw) items.push(btn('سحب من الاعتماد', { cls: 'ghost', onclick: async () => { if (await simple(rid, 'withdraw', 'سحب التقرير', 'سيعود التقرير مسودة ويمكنك تعديله ثم إرساله مجدداً.', 'سحب')) reload(); } }));
    if (a.decide) { items.push(btn('اعتماد', { cls: 'primary', onclick: async () => { if (await decideDialog(rid, 'approve')) reload(); } })); items.push(btn('إعادة للتعديل', { cls: 'ghost', onclick: async () => { if (await decideDialog(rid, 'return')) reload(); } })); }
    if (a.reopen) items.push(btn('إعادة فتح', { cls: 'ghost', onclick: async () => { if (await simple(rid, 'reopen', 'إعادة فتح التقرير', 'سيعود التقرير مسودة لصاحبه.', 'إعادة فتح')) reload(); } }));
    items.push(btn('السجل', { cls: 'ghost', onclick: () => historyDialog(d.history) }));
    box.prepend(...items);
  });
}
