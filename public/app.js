const form = document.getElementById('f');
const sectionsEl = document.getElementById('sections');
const msg = document.getElementById('msg');
const tplSel = document.getElementById('tpl');

const TEMPLATES = {
  'تقرير عام': [['text', 'المقدمة'], ['text', 'التفاصيل'], ['text', 'الخلاصة والتوصيات']],
  'تقرير مشروع': [['text', 'نبذة عن المشروع'], ['kpi', 'مؤشرات المشروع', ['الحالة', 'نسبة الإنجاز', 'الميزانية']], ['table', 'المهام', ['المهمة', 'المسؤول', 'الحالة', 'نسبة الإنجاز']], ['text', 'المخاطر والعوائق'], ['text', 'الخطوات القادمة']],
  'تقرير إنجازات ومهام': [['list', 'المهام المنجزة'], ['list', 'مهام قيد التنفيذ'], ['text', 'التحديات'], ['text', 'ملاحظات']],
  'تقرير للمدير': [['text', 'ملخص تنفيذي'], ['list', 'أبرز النقاط'], ['text', 'المطلوب من الإدارة']],
  'اجتماع الإدارات': [['kpi', 'بيانات الاجتماع', ['التاريخ', 'المكان', 'عدد الحضور']], ['list', 'الحضور'], ['list', 'جدول الأعمال'], ['text', 'ملخص النقاش'], ['table', 'القرارات والتوصيات', ['القرار', 'المسؤول', 'الموعد']]],
  'لوحة مؤشرات': [['kpi', 'نظرة عامة', ['المؤشر الأول', 'المؤشر الثاني', 'المؤشر الثالث']], ['chart', 'الرسم الأول', 'bar', 'half'], ['chart', 'الرسم الثاني', 'donut', 'half'], ['table', 'التفاصيل', ['البند', 'القيمة', 'الملاحظات']]],
  'تقرير فارغ': [],
};
for (const name of Object.keys(TEMPLATES)) tplSel.add(new Option(name, name));

const LABELS = { text: 'نص', list: 'قائمة نقاط', table: 'جدول', kpi: 'أرقام ومؤشرات', chart: 'رسم بياني' };
const KINDS = { bar: 'أعمدة', line: 'خط', donut: 'دائري', hbar: 'أعمدة أفقية' };

function addSection(type, title = '', preset = null, extra = null) {
  const box = document.createElement('fieldset');
  box.className = 'section';
  box.dataset.type = type;
  box.innerHTML = `<legend>${LABELS[type]}</legend>
    <div class="sec-head"><input class="s-title" placeholder="عنوان القسم"><select class="s-width" title="عرض القسم"><option value="full">عرض كامل</option><option value="half">نصف العرض</option></select><button type="button" class="up">↑</button><button type="button" class="down">↓</button><button type="button" class="del">حذف</button></div>
    <div class="s-body"></div>`;
  box.querySelector('.s-title').value = title;
  if (type === 'chart' && extra) box.querySelector('.s-width').value = extra;
  const body = box.querySelector('.s-body');

  if (type === 'text') {
    body.innerHTML = '<textarea rows="4" class="s-text"></textarea>';
  } else if (type === 'list') {
    body.innerHTML = '<textarea rows="4" class="s-list" placeholder="كل سطر يمثل نقطة"></textarea>';
  } else if (type === 'kpi') {
    body.innerHTML = '<div class="kpi-rows"></div><button type="button" class="add-kpi">+ مؤشر</button>';
    const rows = body.querySelector('.kpi-rows');
    const add = (label = '') => {
      const r = document.createElement('div');
      r.className = 'kpi-row';
      r.innerHTML = '<input placeholder="التسمية" class="k-label"><input placeholder="القيمة" class="k-value"><input placeholder="التغيّر (مثل 4% أو -7%)" class="k-trend"><button type="button" class="x">×</button>';
      r.querySelector('.k-label').value = label;
      r.querySelector('.x').onclick = () => r.remove();
      rows.appendChild(r);
    };
    body.querySelector('.add-kpi').onclick = () => add();
    (preset || ['']).forEach(add);
  } else if (type === 'chart') {
    body.innerHTML = `<select class="c-kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <textarea rows="5" class="c-data" placeholder="كل سطر: التسمية | القيمة&#10;مثال:&#10;الأحد | 18&#10;الاثنين | 26&#10;(ويمكنك لصق عمودين من Excel مباشرة)"></textarea>`;
    if (preset) body.querySelector('.c-kind').value = preset;
  } else if (type === 'table') {
    body.innerHTML = `<input class="t-head" placeholder="أسماء الأعمدة مفصولة بفاصلة، مثال: المهمة، المسؤول، الحالة">
      <textarea rows="5" class="t-rows" placeholder="كل سطر صف. افصل بين الخلايا بالرمز | (ويمكنك لصق جدول منسوخ من Excel مباشرة)"></textarea>`;
    if (preset) body.querySelector('.t-head').value = preset.join('، ');
  }

  box.querySelector('.del').onclick = () => box.remove();
  box.querySelector('.up').onclick = () => box.previousElementSibling && box.parentNode.insertBefore(box, box.previousElementSibling);
  box.querySelector('.down').onclick = () => box.nextElementSibling && box.parentNode.insertBefore(box.nextElementSibling, box);
  sectionsEl.appendChild(box);
}

function applyTemplate(name) {
  sectionsEl.replaceChildren();
  for (const [type, title, preset, extra] of TEMPLATES[name]) addSection(type, title, preset, extra);
}
tplSel.onchange = () => {
  if (sectionsEl.querySelector('textarea, .k-label') && [...sectionsEl.querySelectorAll('textarea')].some((t) => t.value) && !confirm('سيتم استبدال الأقسام الحالية. متابعة؟')) return;
  applyTemplate(tplSel.value);
};
document.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => addSection(b.dataset.add)));
applyTemplate(tplSel.value);
form.date.valueAsDate = new Date();

function collect() {
  const sections = [...sectionsEl.querySelectorAll('.section')].map((box) => {
    const type = box.dataset.type;
    const title = box.querySelector('.s-title').value;
    let content;
    if (type === 'text') content = box.querySelector('.s-text').value;
    else if (type === 'list') content = box.querySelector('.s-list').value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    else if (type === 'kpi') content = [...box.querySelectorAll('.kpi-row')].map((r) => ({ label: r.querySelector('.k-label').value, value: r.querySelector('.k-value').value, trend: r.querySelector('.k-trend').value }));
    else if (type === 'chart') {
      const data = box.querySelector('.c-data').value.split(/\r?\n/).filter((l) => l.trim()).map((l) => { const p = l.split(/\t|\|/).map((c) => c.trim()); return { label: p[0], value: p[1] }; });
      content = { kind: box.querySelector('.c-kind').value, data };
    } else {
      const headers = box.querySelector('.t-head').value.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
      const rows = box.querySelector('.t-rows').value.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/\t|\|/).map((c) => c.trim()));
      content = { headers, rows };
    }
    return { type, title, width: box.querySelector('.s-width').value, content };
  });
  return { title: form.title.value, type: tplSel.value, employee: form.employee.value, department: form.department.value, date: form.date.value, sections };
}

form.onsubmit = async (e) => {
  e.preventDefault();
  msg.textContent = 'جاري إنشاء التقرير...';
  try {
    const res = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collect()) });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error);
    location.href = out.url;
  } catch (err) {
    msg.textContent = 'تعذر إنشاء التقرير: ' + err.message;
  }
};
