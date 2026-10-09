#!/usr/bin/env node
// أداة سطر أوامر لإدارة الحسابات المحلية (للطوارئ أو قبل تشغيل الواجهة):
//   node tools/users.js list
//   node tools/users.js add <username> <employee|manager|admin>   (يسأل عن كلمة المرور)
//   node tools/users.js passwd <username>
//   node tools/users.js role <username> <employee|manager|admin>
//   node tools/users.js disable <username> | enable <username>
const readline = require('readline');
const auth = require('../lib/auth');

// قراءة كلمة المرور بدون إظهارها (تعمل على PowerShell وcmd) — الرسائل بالإنجليزية لتجنب مشاكل ترميز الكونسول
function askHidden(q) {
  return new Promise((resolve) => {
    process.stdout.write(q);
    if (!process.stdin.isTTY) { let b = ''; process.stdin.on('data', (d) => (b += d)); process.stdin.on('end', () => resolve(b.trim())); return; }
    let pw = ''; process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === '\u0003') { process.stdout.write('\n'); process.exit(130); }
        if (c === '\r' || c === '\n') { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data', onData); process.stdout.write('\n'); return resolve(pw); }
        if (c === '\u007f' || c === '\b') pw = pw.slice(0, -1); else pw += c;
      }
    };
    process.stdin.on('data', onData);
  });
}
const ask = (q) => askHidden(q);
(async () => {
  const [cmd, u, arg] = process.argv.slice(2);
  try {
    if (cmd === 'list') { auth.listUsers().forEach((x) => console.log(`${x.username.padEnd(20)} ${x.role.padEnd(9)} ${x.source.padEnd(6)} ${x.disabled ? 'DISABLED' : ''} ${x.name}`)); }
    else if (cmd === 'add') { const pw = await ask('Password (hidden, min 8 chars): '); await auth.createLocal({ username: u, name: u, role: arg || 'employee', password: pw }); console.log('Done'); }
    else if (cmd === 'passwd') { const pw = await ask('New password (hidden, min 8 chars): '); await auth.setPassword(u, pw); console.log('Done'); }
    else if (cmd === 'role') { auth.updateUser(u, { role: arg }, ''); console.log('Done'); }
    else if (cmd === 'disable' || cmd === 'enable') { auth.updateUser(u, { disabled: cmd === 'disable' }, ''); console.log('Done'); }
    else console.log('Commands: list | add <u> <role> | passwd <u> | role <u> <role> | disable <u> | enable <u>');
  } catch (e) { console.error('Error: ' + e.message); process.exitCode = 1; }
  setTimeout(() => process.exit(), 800);
})();
