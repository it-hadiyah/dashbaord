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
  'تقرير فارغ': [],
};
for (const name of Object.keys(TEMPLATES)) tplSel.add(new Option(name, name));

const LABELS = { text: 'نص', list: 'قائمة نقاط', table: 'جدول', kpi: 'أرقام ومؤشرات' };

function addSection(type, title = '', preset = null) {
  const box = document.createElement('fieldset');
  box.className = 'section';
  box.dataset.type = type;
  box.innerHTML = `<legend>${LABELS[type]}</legend>
    <div class="sec-head"><input class="s-title" placeholder="عنوان القسم"><button type="button" class="up">↑</button><button type="button" class="down">↓</button><button type="button" class="del">حذف</button></div>
    <div class="s-body"></div>`;
  box.querySelector('.s-title').value = title;
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
      r.innerHTML = '<input placeholder="التسمية" class="k-label"><input placeholder="القيمة" class="k-value"><button type="button" class="x">×</button>';
      r.querySelector('.k-label').value = label;
      r.querySelector('.x').onclick = () => r.remove();
      rows.appendChild(r);
    };
    body.querySelector('.add-kpi').onclick = () => add();
    (preset || ['']).forEach(add);
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
  for (const [type, title, preset] of TEMPLATES[name]) addSection(type, title, preset);
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
    else if (type === 'kpi') content = [...box.querySelectorAll('.kpi-row')].map((r) => ({ label: r.querySelector('.k-label').value, value: r.querySelector('.k-value').value }));
    else {
      const headers = box.querySelector('.t-head').value.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
      const rows = box.querySelector('.t-rows').value.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/\t|\|/).map((c) => c.trim()));
      content = { headers, rows };
    }
    return { type, title, content };
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
