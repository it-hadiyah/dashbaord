'use strict';
// التحقق من حساب الدومين (Active Directory) عبر PowerShell على السيرفر (يجب أن يكون منضمّاً للدومين).
// كلمة المرور تُمرَّر عبر stdin فقط (وليس في سطر الأوامر)، ولا تُسجَّل في أي مكان.
const { spawn } = require('child_process');
const path = require('path');
const DEFAULT_CMD = ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, '..', 'tools', 'ad-auth.ps1')];

function authenticate({ domain, username, password, command }) {
  return new Promise((resolve) => {
    const cmd = Array.isArray(command) && command.length ? command : DEFAULT_CMD;
    let out = '', err = '', done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    let child;
    try { child = spawn(cmd[0], cmd.slice(1), { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }); } catch (e) { return fin({ ok: false, unavailable: true }); }
    const timer = setTimeout(() => { try { child.kill(); } catch (e) { /* ignore */ } fin({ ok: false, unavailable: true, reason: 'timeout' }); }, 20000);
    child.on('error', () => { clearTimeout(timer); fin({ ok: false, unavailable: true }); });
    child.stdout.on('data', (d) => { out += d; if (out.length > 65536) child.kill(); });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', () => {
      clearTimeout(timer);
      try { const r = JSON.parse(out.trim().split('\n').pop()); fin(r && r.ok ? r : { ok: false, unavailable: !!(r && r.error) }); }
      catch (e) { fin({ ok: false, unavailable: true }); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ domain: domain || '', username, password }), 'utf8');
  });
}
module.exports = { authenticate };
