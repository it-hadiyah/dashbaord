#!/usr/bin/env node
// أداة سطر أوامر لإدارة الحسابات المحلية (للطوارئ أو قبل تشغيل الواجهة):
//   node tools/users.js list
//   node tools/users.js add <username> <employee|manager|admin>   (يسأل عن كلمة المرور)
//   node tools/users.js passwd <username>
//   node tools/users.js role <username> <employee|manager|admin>
//   node tools/users.js disable <username> | enable <username>
const readline = require('readline');
const auth = require('../lib/auth');

function ask(q, hidden) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) { rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); }; }
    rl.question(q, (a) => { rl.close(); if (hidden) console.log(); res(a); });
  });
}
(async () => {
  const [cmd, u, arg] = process.argv.slice(2);
  try {
    if (cmd === 'list') { auth.listUsers().forEach((x) => console.log(`${x.username.padEnd(20)} ${x.role.padEnd(9)} ${x.source.padEnd(6)} ${x.disabled ? 'معطّل' : ''} ${x.name}`)); }
    else if (cmd === 'add') { const pw = await ask('كلمة المرور: ', true); await auth.createLocal({ username: u, name: u, role: arg || 'employee', password: pw }); console.log('تم'); }
    else if (cmd === 'passwd') { const pw = await ask('كلمة المرور الجديدة: ', true); await auth.setPassword(u, pw); console.log('تم'); }
    else if (cmd === 'role') { auth.updateUser(u, { role: arg }, ''); console.log('تم'); }
    else if (cmd === 'disable' || cmd === 'enable') { auth.updateUser(u, { disabled: cmd === 'disable' }, ''); console.log('تم'); }
    else console.log('الأوامر: list | add <u> <role> | passwd <u> | role <u> <role> | disable <u> | enable <u>');
  } catch (e) { console.error('خطأ: ' + e.message); process.exitCode = 1; }
  setTimeout(() => process.exit(), 800);
})();
