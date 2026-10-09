const form = document.getElementById('f');
const tasks = document.getElementById('tasks');
const msg = document.getElementById('msg');

function addTask() {
  const row = document.createElement('div');
  row.className = 'task';
  row.innerHTML = `<input placeholder="المهمة" data-k="name"><input placeholder="المسؤول" data-k="owner">
    <select data-k="status"><option>قيد التنفيذ</option><option>مكتملة</option><option>متأخرة</option></select>
    <input type="number" min="0" max="100" value="0" data-k="progress" title="نسبة الإنجاز">
    <button type="button" class="del">×</button>`;
  row.querySelector('.del').onclick = () => row.remove();
  tasks.appendChild(row);
}
document.getElementById('add').onclick = addTask;
addTask();

form.onsubmit = async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  data.tasks = [...tasks.querySelectorAll('.task')].map((r) =>
    Object.fromEntries([...r.querySelectorAll('[data-k]')].map((i) => [i.dataset.k, i.value])));
  msg.textContent = 'جاري إنشاء التقرير...';
  try {
    const res = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error);
    location.href = out.url;
  } catch (err) {
    msg.textContent = 'تعذر إنشاء التقرير: ' + err.message;
  }
};
