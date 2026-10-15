#!/usr/bin/env node
'use strict';
// End-to-end check of the MCP server against a running dashboard.
// Usage: RB_USER=admin RB_PASS=... node mcp/selftest.js   (creates one draft report titled "[MCP selftest] ...")
const { spawn } = require('child_process');
const assert = require('assert');
const path = require('path');

const p = spawn(process.execPath, [path.join(__dirname, 'server.js')], { env: process.env, stdio: ['pipe', 'pipe', 'inherit'] });
let buf = '', n = 0; const wait = new Map();
p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); wait.get(m.id)(m); } });
const rpc = (method, params) => new Promise((ok) => { const id = ++n; wait.set(id, ok); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
const call = async (name, args) => { const r = (await rpc('tools/call', { name, arguments: args })).result; assert(!r.isError, name + ': ' + r.content[0].text); return JSON.parse(r.content[0].text); };

(async () => {
  assert.strictEqual((await rpc('initialize', { protocolVersion: '2025-06-18' })).result.serverInfo.name, 'hadiyah-reports');
  const tools = (await rpc('tools/list')).result.tools.map((t) => t.name);
  assert(tools.includes('create_report') && !tools.some((t) => /approve|share/.test(t)), 'tool list');
  assert((await call('list_templates')).length > 10, 'templates');
  const rep = await call('get_template_skeleton', { template_id: 'monthly' });
  assert.strictEqual(rep.sections.length, 6);
  await call('list_indicators');

  rep.title = '[MCP selftest] تقرير تجريبي'; rep.department = 'تقنية المعلومات';
  rep.sections[0].content = '<p>نص تجريبي من اختبار MCP.</p>';
  rep.sections[1].content.items[0].value = '1';
  const made = await call('create_report', { report: rep });
  assert(made.id && made.viewUrl.endsWith('.html'), 'create');
  const got = await call('get_report', { id: made.id });
  assert.strictEqual(got.title, rep.title);
  assert.strictEqual(got.workflow.status, 'draft');
  assert.strictEqual(got.sections[1].content.items[0].value, '1');
  got.subtitle = 'تعديل'; await call('update_report', { id: made.id, report: got });
  assert.strictEqual((await call('get_report', { id: made.id })).subtitle, 'تعديل');
  assert((await call('list_reports')).some((r) => r.id === made.id), 'list');

  // agent-shaped report WITHOUT version must keep palette, period and callout (legacy-migration trap)
  const raw = await call('create_report', { report: { title: '[MCP selftest] بدون رقم إصدار', palette: 'navy', period: 'سبتمبر', sections: [{ type: 'callout', title: 'تنبيه', content: { tone: 'warn', text: 'اختبار' } }] } });
  const rb = await call('get_report', { id: raw.id });
  assert.strictEqual(rb.palette, 'navy'); assert.strictEqual(rb.period, 'سبتمبر');
  assert.strictEqual(rb.sections[0].type, 'callout'); assert.strictEqual(rb.sections[0].content.text, 'اختبار');

  const bad = (await rpc('tools/call', { name: 'create_report', arguments: { report: { title: '' } } })).result;
  assert(bad.isError, 'empty title must fail');
  console.log('PASS — draft report:', made.viewUrl);
  p.kill();
})().catch((e) => { console.error('FAIL:', e.message); p.kill(); process.exit(1); });
