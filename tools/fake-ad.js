#!/usr/bin/env node
// بديل تجريبي لـ ad-auth.ps1 يُستخدم في الاختبارات فقط (يحاكي الدومين). لا تفعّله في الإنتاج.
let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  const { username, password } = JSON.parse(raw);
  const people = {
    sara: { name: 'سارة العتيبي', department: 'تقنية المعلومات', manager: 'khalid', groups: ['Domain Users'] },
    khalid: { name: 'خالد الشمري', department: 'الإدارة', manager: '', groups: ['Domain Users', 'RB-Managers'] },
    omar: { name: 'عمر الحربي', department: 'المالية', manager: 'khalid', groups: ['Domain Users'] },
  };
  const p = people[String(username).toLowerCase()];
  if (process.env.FAKE_AD_DOWN) { console.log(JSON.stringify({ ok: false, error: 'domain unreachable' })); return; }
  if (!p || password !== 'ad-pass-123') { console.log(JSON.stringify({ ok: false })); return; }
  console.log(JSON.stringify(Object.assign({ ok: true, username, email: username + '@example.org', enabled: true, title: '' }, p)));
});
