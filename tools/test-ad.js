#!/usr/bin/env node
// Domain login diagnostic (run on the web server):   node tools\test-ad.js da.ali
// Reads the domain settings from config.json, asks for the password (hidden) and prints the result / the reason of failure.
const ad = require('../lib/ad');
const cfg = require('../lib/config').get().auth;

function askHidden(q) {
  return new Promise((resolve) => {
    process.stdout.write(q);
    if (!process.stdin.isTTY) { let b = ''; process.stdin.on('data', (d) => (b += d)); process.stdin.on('end', () => resolve(b.trim())); return; }
    let pw = ''; process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\u0003') { process.stdout.write('\n'); process.exit(130); }
        if (c === '\r' || c === '\n') { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data', onData); process.stdout.write('\n'); return resolve(pw); }
        if (c === '\u007f' || c === '\b') pw = pw.slice(0, -1); else pw += c;
      }
    };
    process.stdin.on('data', onData);
  });
}
(async () => {
  const user = (process.argv[2] || '').trim();
  if (!user) { console.log('Usage: node tools\\test-ad.js <username>'); process.exit(1); }
  console.log(`Domain: ${cfg.domain || '(default)'}   Server: ${cfg.server || '(none)'}   Mode: ${cfg.mode}`);
  const password = await askHidden('Password (hidden): ');
  const t0 = Date.now();
  const r = await ad.authenticate({ domain: cfg.domain, server: cfg.server, username: user, password, command: cfg.adCommand });
  console.log(`Finished in ${Date.now() - t0} ms\n`);
  if (r.ok) { const { ok, ...info } = r; console.log('SUCCESS - credentials are valid'); console.log(JSON.stringify(info, null, 2)); }
  else if (r.unavailable) { console.log('FAILED - could not talk to the domain'); console.log('Reason:', r.reason || '(none)'); }
  else console.log('FAILED - wrong username/password (or the account is locked/disabled)');
  process.exit(r.ok ? 0 : 2);
})();
