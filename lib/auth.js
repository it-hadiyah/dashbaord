'use strict';
// المستخدمون والجلسات وتسجيل الدخول (حسابات الدومين + حسابات محلية احتياطية) وحماية المحاولات
const crypto = require('crypto');
const store = require('./store');
const cfgm = require('./config');
const T = require('../public/shared/templates.js');
const TEMPLATE_IDS = T.TEMPLATES.map((t) => t.id);
const ad = require('./ad');

const ROLES = ['employee', 'manager', 'admin'];
const RANK = { employee: 0, manager: 1, admin: 2 };
const USER_RE = /^[a-z0-9._-]{1,64}$/;
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000, ABS_MS = 24 * 3600 * 1000;

let users = store.readJson('users.json', []);
const saveUsers = () => store.writeJson('users.json', users);
const norm = (u) => String(u == null ? '' : u).trim().toLowerCase().replace(/^.*\\/, '').replace(/@.*$/, '');
const validName = (u) => USER_RE.test(u);

/* ---------- كلمات المرور (scrypt) ---------- */
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));
async function hashPassword(pw) { const salt = crypto.randomBytes(16); return 'scrypt$' + salt.toString('hex') + '$' + (await scrypt(pw, salt)).toString('hex'); }
async function verifyPassword(pw, stored) {
  const [alg, s, h] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const a = await scrypt(pw, Buffer.from(s, 'hex')), b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const strongEnough = (pw) => typeof pw === 'string' && pw.length >= 8 && pw.length <= 200;

/* ---------- المستخدمون ---------- */
const find = (u) => users.find((x) => x.username === norm(u));
const publicUser = (u) => u && ({ username: u.username, name: u.name || u.username, role: u.role, source: u.source, email: u.email || '', department: u.department || '', managerUsername: u.managerUsername || '', disabled: !!u.disabled, lastLogin: u.lastLogin || null, createdAt: u.createdAt, allowedTemplates: Array.isArray(u.allowedTemplates) ? u.allowedTemplates : null });

/* ---------- الإعدادات العامة: أنواع التقارير الافتراضية للمستخدمين الجدد ---------- */
const getSettings = () => Object.assign({ defaultTemplates: null }, store.readJson('settings.json', {}));
function cleanTemplates(list) {
  if (list === null || list === undefined) return null;
  if (!Array.isArray(list)) throw new Error('قائمة غير صالحة');
  const out = [...new Set(list.map(String))]; if (out.some((id) => !TEMPLATE_IDS.includes(id))) throw new Error('نوع تقرير غير معروف');
  return out;
}
function setSettings(patch) { const s = getSettings(); if ('defaultTemplates' in patch) s.defaultTemplates = cleanTemplates(patch.defaultTemplates); store.writeJson('settings.json', s); return s; }
const newUserTemplates = () => { const d = getSettings().defaultTemplates; return Array.isArray(d) ? d.slice() : null; };
const listUsers = () => users.map(publicUser).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
const listManagers = () => users.filter((u) => !u.disabled && RANK[u.role] >= 1).map(publicUser);

function effectiveRole(u, adInfo) {
  const c = cfgm.get().auth;
  const inList = (arr) => (arr || []).map(norm).includes(u.username);
  const groups = ((adInfo && adInfo.groups) || []).map((g) => String(g).toLowerCase());
  const hasGroup = (arr) => (arr || []).some((g) => groups.includes(String(g).toLowerCase()));
  let role = ROLES.includes(u.role) ? u.role : 'employee';
  if (inList(c.admins) || hasGroup(c.adminGroups)) role = 'admin';
  else if ((inList(c.managers) || hasGroup(c.managerGroups)) && RANK[role] < 1) role = 'manager';
  return role;
}

// تسجيل مسؤولين/مدراء مذكورين في الإعدادات حتى يظهروا في القوائم قبل أول دخول لهم
function syncConfiguredUsers() {
  const c = cfgm.get().auth; let changed = false;
  for (const [list, role] of [[c.admins, 'admin'], [c.managers, 'manager']]) {
    for (const raw of list || []) {
      const u = norm(raw); if (!validName(u)) continue;
      const ex = find(u);
      if (!ex) { users.push({ username: u, name: u, role, source: 'ad', createdAt: new Date().toISOString() }); changed = true; }
      else if (RANK[ex.role] < RANK[role]) { ex.role = role; changed = true; }
    }
  }
  if (changed) saveUsers();
}

async function bootstrapAdmin() {
  syncConfiguredUsers();
  if (users.some((u) => u.source === 'local' && u.role === 'admin' && !u.disabled)) return null;
  const pw = crypto.randomBytes(9).toString('base64url');
  users = users.filter((u) => u.username !== 'admin');
  users.push({ username: 'admin', name: 'مدير النظام', role: 'admin', source: 'local', passwordHash: await hashPassword(pw), createdAt: new Date().toISOString() });
  saveUsers(); store.audit({ action: 'bootstrap-admin', by: 'system' });
  return pw;
}

async function createLocal({ username, name, role, password }) {
  const u = norm(username);
  if (!validName(u)) throw new Error('اسم المستخدم غير صالح (حروف إنجليزية وأرقام و . _ - فقط)');
  if (find(u)) throw new Error('اسم المستخدم موجود مسبقاً');
  if (!strongEnough(password)) throw new Error('كلمة المرور يجب أن لا تقل عن 8 أحرف');
  const rec = { username: u, name: String(name || u).slice(0, 120), role: ROLES.includes(role) ? role : 'employee', source: 'local', passwordHash: await hashPassword(password), createdAt: new Date().toISOString(), allowedTemplates: newUserTemplates() };
  users.push(rec); saveUsers(); return publicUser(rec);
}
function addDomainUser({ username, name, role }) {
  const u = norm(username);
  if (!validName(u)) throw new Error('اسم المستخدم غير صالح');
  if (find(u)) throw new Error('المستخدم موجود مسبقاً');
  const rec = { username: u, name: String(name || u).slice(0, 120), role: ROLES.includes(role) ? role : 'employee', source: 'ad', createdAt: new Date().toISOString(), allowedTemplates: newUserTemplates() };
  users.push(rec); saveUsers(); return publicUser(rec);
}
function updateUser(username, patch, actor) {
  const u = find(username); if (!u) throw new Error('المستخدم غير موجود');
  if (patch.role !== undefined) {
    if (!ROLES.includes(patch.role)) throw new Error('دور غير صالح');
    if (u.username === actor && patch.role !== 'admin') throw new Error('لا يمكنك إنزال صلاحيتك أنت');
    u.role = patch.role;
  }
  if (patch.disabled !== undefined) {
    if (u.username === actor && patch.disabled) throw new Error('لا يمكنك تعطيل حسابك أنت');
    u.disabled = !!patch.disabled; if (u.disabled) revokeSessions(u.username);
  }
  if (patch.name !== undefined) u.name = String(patch.name).slice(0, 120);
  if ('allowedTemplates' in patch) u.allowedTemplates = cleanTemplates(patch.allowedTemplates);
  saveUsers(); return publicUser(u);
}
async function setPassword(username, pw) {
  const u = find(username); if (!u || u.source !== 'local') throw new Error('كلمة المرور تُدار من الدومين لهذا الحساب');
  if (!strongEnough(pw)) throw new Error('كلمة المرور يجب أن لا تقل عن 8 أحرف');
  u.passwordHash = await hashPassword(pw); saveUsers(); revokeSessions(u.username);
}
async function changeOwnPassword(username, current, next) {
  const u = find(username); if (!u || u.source !== 'local') throw new Error('كلمة المرور تُدار من الدومين');
  if (!(await verifyPassword(current, u.passwordHash))) throw new Error('كلمة المرور الحالية غير صحيحة');
  await setPassword(username, next);
}
function deleteUser(username, actor) {
  const u = find(username); if (!u) throw new Error('المستخدم غير موجود');
  if (u.username === actor) throw new Error('لا يمكنك حذف حسابك أنت');
  users = users.filter((x) => x !== u); saveUsers(); revokeSessions(u.username);
}

/* ---------- الجلسات ---------- */
let sessions = store.readJson('sessions.json', {});
const hashTok = (t) => crypto.createHash('sha256').update(t).digest('hex');
let saveTimer;
const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { store.writeJson('sessions.json', sessions); } catch (e) { /* ignore */ } }, 500); };
function prune() { const now = Date.now(), idle = cfgm.get().auth.sessionHours * 3600 * 1000; for (const k of Object.keys(sessions)) { const s = sessions[k]; if (now - s.last > idle || now - s.created > ABS_MS) delete sessions[k]; } }
function createSession(username, ip) { prune(); const t = crypto.randomBytes(32).toString('base64url'); sessions[hashTok(t)] = { username, created: Date.now(), last: Date.now(), ip }; persist(); return t; }
function sessionUser(token) {
  if (!token) return null;
  const k = hashTok(token), s = sessions[k]; if (!s) return null;
  const now = Date.now(), idle = cfgm.get().auth.sessionHours * 3600 * 1000;
  if (now - s.last > idle || now - s.created > ABS_MS) { delete sessions[k]; persist(); return null; }
  const u = find(s.username); if (!u || u.disabled) { delete sessions[k]; persist(); return null; }
  if (now - s.last > 60000) { s.last = now; persist(); }
  const role = effectiveRole(u, null);
  return Object.assign(publicUser(u), { role, allowedTemplates: role === 'admin' ? null : (Array.isArray(u.allowedTemplates) ? u.allowedTemplates : null) });
}
function destroySession(token) { if (token) { delete sessions[hashTok(token)]; persist(); } }
function revokeSessions(username) { for (const k of Object.keys(sessions)) if (sessions[k].username === username) delete sessions[k]; persist(); }

/* ---------- حماية من تخمين كلمات المرور ---------- */
const fails = new Map();
const failKey = (ip, u) => ip + '|' + u;
function lockedFor(ip, u) { const f = fails.get(failKey(ip, u)), g = fails.get('u|' + u); const now = Date.now(); return Math.max(f && f.until > now ? f.until - now : 0, g && g.until > now ? g.until - now : 0); }
function noteFail(ip, u) {
  for (const k of [failKey(ip, u), 'u|' + u]) { const f = fails.get(k) || { n: 0, until: 0 }; f.n += 1; if (f.n >= (k.startsWith('u|') ? MAX_FAILS * 3 : MAX_FAILS)) { f.until = Date.now() + LOCK_MS; f.n = 0; } fails.set(k, f); }
}
const clearFails = (ip, u) => { fails.delete(failKey(ip, u)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- تسجيل الدخول ---------- */
async function login(rawUser, password, ip) {
  const u = norm(rawUser), c = cfgm.get().auth;
  const bad = (code, msg) => ({ ok: false, code, error: msg });
  if (!validName(u) || typeof password !== 'string' || !password || password.length > 300) { await sleep(400); return bad('invalid', 'اسم المستخدم أو كلمة المرور غير صحيحة'); }
  const wait = lockedFor(ip, u);
  if (wait > 0) { store.audit({ action: 'login-locked', user: u, ip }); return bad('locked', `تم إيقاف المحاولات مؤقتاً. حاول بعد ${Math.ceil(wait / 60000)} دقيقة.`); }

  let rec = find(u), adInfo = null, ok = false;
  if (rec && rec.source === 'local') {
    ok = !rec.disabled && (await verifyPassword(password, rec.passwordHash));
  } else if (c.mode === 'ad') {
    if (rec && rec.disabled) { ok = false; }
    else {
      const r = await ad.authenticate({ domain: c.domain, server: c.server, username: u, password, command: c.adCommand });
      if (r.unavailable) { store.audit({ action: 'login-ad-unavailable', user: u, ip }); return bad('unavailable', 'تعذر الاتصال بخدمة الدومين. أخبر مسؤول النظام.'); }
      if (r.ok && r.enabled === false) ok = false;
      else if (r.ok) { ok = true; adInfo = r; }
    }
  }
  if (!ok) { noteFail(ip, u); store.audit({ action: 'login-failed', user: u, ip }); await sleep(600); return bad('invalid', 'اسم المستخدم أو كلمة المرور غير صحيحة'); }

  if (adInfo) {
    if (!rec) { rec = { username: u, role: 'employee', source: 'ad', createdAt: new Date().toISOString(), allowedTemplates: newUserTemplates() }; users.push(rec); }
    rec.name = adInfo.name || rec.name || u; rec.email = adInfo.email || rec.email || ''; rec.department = adInfo.department || rec.department || '';
    rec.managerUsername = adInfo.manager ? norm(adInfo.manager) : (rec.managerUsername || '');
    const eff = effectiveRole(rec, adInfo); if (RANK[eff] > RANK[rec.role || 'employee']) rec.role = eff;
  }
  rec.lastLogin = new Date().toISOString(); saveUsers(); clearFails(ip, u);
  const token = createSession(u, ip);
  store.audit({ action: 'login', user: u, ip });
  return { ok: true, token, user: Object.assign(publicUser(rec), { role: effectiveRole(rec, adInfo) }) };
}

const canUseTemplate = (user, id) => !user || user.role === 'admin' || !Array.isArray(user.allowedTemplates) || user.allowedTemplates.includes(id);

module.exports = { getSettings, setSettings, canUseTemplate, TEMPLATE_IDS, norm, validName, login, sessionUser, destroySession, find, listUsers, listManagers, createLocal, addDomainUser, updateUser, setPassword, changeOwnPassword, deleteUser, bootstrapAdmin, publicUser, RANK, ROLES };
