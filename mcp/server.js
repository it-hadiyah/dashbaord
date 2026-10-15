#!/usr/bin/env node
'use strict';
// MCP server (stdio, no dependencies): lets an AI agent build full reports in the running dashboard.
// Talks to the app's own HTTP API, so all validation, permissions and audit logging still apply.
// Env: RB_URL (default http://localhost:3000), RB_USER, RB_PASS.
// Reports are created as drafts only — submitting/approving stays with a human.
const T = require('../public/shared/templates.js');

const BASE = (process.env.RB_URL || 'http://localhost:3000').replace(/\/$/, '');
let cookie = '';

async function login() {
  if (!process.env.RB_USER || !process.env.RB_PASS) throw new Error('Set RB_USER and RB_PASS env vars for the MCP server');
  const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: process.env.RB_USER, password: process.env.RB_PASS }) });
  if (!r.ok) throw new Error('Login failed (' + r.status + '): ' + (await r.text()));
  cookie = (r.headers.get('set-cookie') || '').split(';')[0];
}
async function api(method, path, body, retry = true) {
  if (!cookie) await login();
  const r = await fetch(BASE + path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401 && retry) { cookie = ''; return api(method, path, body, false); }
  const text = await r.text();
  if (!r.ok) throw new Error(method + ' ' + path + ' -> ' + r.status + ': ' + text);
  return text ? JSON.parse(text) : {};
}

const SECTION_SCHEMA = `Report JSON: { template, title (required), subtitle, period, employee, department, date "YYYY-MM-DD",
palette (${Object.keys(T.PALETTES).join('|')}), options {cover, toc, closing, header, pageNumbers, margins narrow|normal|wide, arabicDigits},
sections: [ { type, title, icon, visible, width full|half, source, asOf "YYYY-MM-DD", content } ] }
Section content by type:
- text: HTML string, e.g. "<p>...</p><ul><li>..</li></ul>"
- list: { ordered: bool, items: [string] }
- table: { headers: [string] (max 12), rows: [[string]], zebra: bool, heat: bool }
- kpi: { style: cards|highlights, items: [{ label, value, trend e.g. "+9%", icon }] }
- chart: { kind: bar|line|area|donut|pie|hbar|waterfall|gauge|radar|funnel, unit, max, data: [{ label, value }], ref: "ind-..." optional indicator id (live data) }
- progress: { items: [{ label, value: "0-100" }] }
- timeline: { items: [{ date, title, desc, status: done|active|todo }] }
- gantt: { items: [{ name, start "YYYY-MM-DD", end "YYYY-MM-DD", progress "0-100", owner }] }
- compare: { labels: { prev, curr }, rows: [{ label, prev, curr, unit, better: up|down }], chart: bool, summary: bool, decimals: 0|1|2 }
- callout: { tone: info|success|warn, text }
- calc: { style: table|cards, rows: [{ key "A".."Z", label, kind: input|calc, value, unit, fmt: number|percent, op, args: ["A","B"], formula }] }
- image: { src: data:image/... URL, caption, fit: contain|cover, height }
- pagebreak: {}
All values are strings. Write content in Arabic (the org's language) unless told otherwise.
Use only real numbers you were given or that come from list_indicators — never invent figures; leave a value empty if unknown.`;

const TOOLS = [
  { name: 'list_templates', description: 'List report templates (id, name, category, description, section outline).', inputSchema: { type: 'object', properties: {} },
    run: () => T.TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category, desc: t.desc, sections: (t.sections || []).map((s) => s.type + ': ' + s.title) })) },
  { name: 'get_template_skeleton', description: 'Empty report JSON for a template (sections with hints, no sample data). Fill it in, then pass to create_report.\n\n' + SECTION_SCHEMA,
    inputSchema: { type: 'object', properties: { template_id: { type: 'string' } }, required: ['template_id'] },
    run: (a) => { if (!T.TEMPLATES.some((t) => t.id === a.template_id)) throw new Error('Unknown template: ' + a.template_id); return T.createReport(a.template_id, { sample: false }); } },
  { name: 'list_indicators', description: 'Central indicator data series (real org data). Use their numbers, or reference one from a chart via content.ref.', inputSchema: { type: 'object', properties: {} },
    run: () => api('GET', '/api/indicators') },
  { name: 'create_report', description: 'Create a new DRAFT report. Returns id and view URL.\n\n' + SECTION_SCHEMA,
    inputSchema: { type: 'object', properties: { report: { type: 'object' } }, required: ['report'] },
    run: async (a) => { const r = await api('POST', '/api/reports', a.report); return Object.assign(r, { viewUrl: BASE + r.url }); } },
  { name: 'update_report', description: 'Replace a report\'s full content (send the whole report JSON, not a patch). Only works while it is a draft/returned.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, report: { type: 'object' } }, required: ['id', 'report'] },
    run: async (a) => { const r = await api('PUT', '/api/reports/' + encodeURIComponent(a.id), a.report); return Object.assign(r, { viewUrl: BASE + r.url }); } },
  { name: 'get_report', description: 'Read a report\'s full JSON (to review or edit it).', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    run: (a) => api('GET', '/api/reports/' + encodeURIComponent(a.id)) },
  { name: 'list_reports', description: 'List reports owned by the MCP account.', inputSchema: { type: 'object', properties: {} },
    run: () => api('GET', '/api/reports?scope=mine') },
];

// --- minimal MCP transport: JSON-RPC 2.0 over stdio (default) or HTTP (set MCP_HTTP_PORT) ---
async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined) return null; // notifications
  const ok = (result) => ({ jsonrpc: '2.0', id, result }), err = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  try {
    if (method === 'initialize') return ok({ protocolVersion: (params && params.protocolVersion) || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'hadiyah-reports', version: '1.0.0' } });
    if (method === 'ping') return ok({});
    if (method === 'tools/list') return ok({ tools: TOOLS.map(({ run, ...t }) => t) });
    if (method === 'tools/call') {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return err(-32602, 'Unknown tool: ' + params.name);
      try { return ok({ content: [{ type: 'text', text: JSON.stringify(await tool.run(params.arguments || {}), null, 2) }] }); }
      catch (e) { return ok({ content: [{ type: 'text', text: e.message }], isError: true }); }
    }
    return err(-32601, 'Method not found: ' + method);
  } catch (e) { return err(-32603, e.message); }
}

if (process.env.MCP_HTTP_PORT) {
  // Stateless Streamable HTTP for remote clients (e.g. ChatGPT connectors).
  // ChatGPT can't send a static auth header, so the URL itself carries the secret: /mcp/<MCP_SECRET>
  // ponytail: secret-in-URL auth; switch to OAuth before exposing the real company dashboard.
  const secret = process.env.MCP_SECRET || '';
  if (secret.length < 24) { console.error('MCP_SECRET (24+ chars) is required in HTTP mode'); process.exit(1); }
  require('http').createServer(async (req, res) => {
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(body ? JSON.stringify(body) : ''); };
    if (req.url.split('?')[0] !== '/mcp/' + secret) return send(404, { error: 'not found' });
    if (req.method !== 'POST') return send(405, { error: 'POST only' });
    let body = ''; for await (const c of req) { body += c; if (body.length > 5e6) return send(413, { error: 'too large' }); }
    let msg; try { msg = JSON.parse(body); } catch (e) { return send(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
    if (Array.isArray(msg)) { const r = (await Promise.all(msg.map(handle))).filter(Boolean); return r.length ? send(200, r) : send(202); }
    const r = await handle(msg); return r ? send(200, r) : send(202);
  }).listen(Number(process.env.MCP_HTTP_PORT), '127.0.0.1', () => console.error('MCP HTTP on http://127.0.0.1:' + process.env.MCP_HTTP_PORT + '/mcp/<secret>'));
} else {
  let buf = '';
  process.stdin.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let msg; try { msg = JSON.parse(line); } catch (e) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n'); continue; }
      handle(msg).then((r) => r && process.stdout.write(JSON.stringify(r) + '\n'));
    }
  });
}
