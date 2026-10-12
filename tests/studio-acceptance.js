// اختبار قبول HADIYAH Studio (آلي وبصري). التشغيل: NODE_PATH=$(npm root -g) node tests/studio-acceptance.js
// يتطلب مكتبة playwright ومتصفح Chromium. يعمل على بيانات مؤقتة منفصلة ولا يلمس reports/ أو decks/ أو data/.
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { chromium } = require('playwright');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-acc-'));
for (const d of ['data', 'reports', 'decks']) fs.mkdirSync(path.join(tmp, d));
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
cfg.auth = Object.assign(cfg.auth, { mode: 'local', admins: [] }); fs.writeFileSync(path.join(tmp, 'config.json'), JSON.stringify(cfg));
const PORT = 3090 + Math.floor(Math.random() * 50), base = 'http://localhost:' + PORT;
const R = []; const ok = (c, m) => { R.push(c); console.log((c ? 'PASS ' : 'FAIL ') + m); };

(async () => {
  let out = '';
  const srv = spawn('node', ['server.js'], { cwd: path.join(__dirname, '..'), env: Object.assign({}, process.env, { PORT, RB_DATA: path.join(tmp, 'data'), RB_REPORTS: path.join(tmp, 'reports'), RB_DECKS: path.join(tmp, 'decks'), RB_CONFIG: path.join(tmp, 'config.json') }) });
  srv.stdout.on('data', (d) => (out += d)); srv.stderr.on('data', (d) => (out += d));
  await new Promise((r) => setTimeout(r, 1800));
  const pw = (out.match(/كلمة المرور : (\S+)/) || [])[1];
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/401/.test(m.text()) && errs.push(m.text()));
  // صورتان اختباريتان تُولَّدان داخل المتصفح
  const mkImg = (hue) => p.evaluate((h) => { const c = document.createElement('canvas'); c.width = 1400; c.height = 875; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 1400, 875); gr.addColorStop(0, `hsl(${h},50%,60%)`); gr.addColorStop(1, `hsl(${h + 60},45%,40%)`); g.fillStyle = gr; g.fillRect(0, 0, 1400, 875); g.fillStyle = '#e8c9a4'; g.beginPath(); g.arc(700, 330, 130, 0, 7); g.fill(); g.fillStyle = '#f2f2f2'; g.fillRect(560, 470, 280, 405); return c.toDataURL('image/jpeg', 0.8).split(',')[1]; }, hue);
  await p.goto(base + '/login.html'); await p.fill('#u', 'admin'); await p.fill('#p', pw); await p.click('#go'); await p.waitForURL(/dashboard/);
  const img1 = Buffer.from(await mkImg(200), 'base64'), img2 = Buffer.from(await mkImg(20), 'base64');

  // 1) اختيار القالب: المعرض → المحرر بالتصميم نفسه
  await p.goto(base + '/decks.html'); await p.waitForSelector('#tpls .tcard');
  const cats = await p.locator('#tpls .chips .chip').allInnerTexts(); ok(cats.includes('رسمي هدية') && cats.includes('★ المفضلة'), 'gallery: categories + favorites');
  for (const sel of ['.gal-tools .search', '.tcard .thumb', '.tcard .thumb-tabs', '.tcard .tinfo', '.tcard .tact']) ok((await p.locator('#tpls ' + sel).count()) > 0, 'gallery shares component ' + sel);
  const card = p.locator('#tpls .tcard', { hasText: 'العرض الرسمي الكامل' }); await card.scrollIntoViewIfNeeded(); await card.locator('.thumb .slide').waitFor(); await p.waitForTimeout(600);
  const galShot = await card.locator('.thumb').screenshot(); if (process.env.KEEP) fs.writeFileSync('/tmp/gal.png', galShot);
  await card.locator('text=استخدم القالب').first().click(); await p.waitForURL(/deck\.html/); await p.waitForSelector('.dk-th'); await p.waitForTimeout(1200);
  const editShot = await p.locator('.dk-stage').screenshot(); if (process.env.KEEP) fs.writeFileSync('/tmp/edit.png', editShot); const id = new URL(p.url()).searchParams.get('id');
  ok((await p.locator('.dk-th').count()) === 16, 'editor opens all 16 official slides');
  // مقارنة الصور داخل المتصفح
  const diff = (a, c) => p.evaluate(async ([a, c]) => { const load = (b) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b; }); const [A, B] = await Promise.all([load(a), load(c)]); const cv = (im) => { const k = document.createElement('canvas'); k.width = 640; k.height = 360; const g = k.getContext('2d'); g.drawImage(im, 0, 0, 640, 360); return g.getImageData(0, 0, 640, 360).data; }; const x = cv(A), y = cv(B); let s = 0; for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]); return s / x.length / 255 * 100; }, [a.toString('base64'), c.toString('base64')]);
  const d1 = await diff(galShot, editShot); ok(d1 < 3, 'gallery preview == editor (diff ' + d1.toFixed(2) + '%)');

  // 2) استبدال الصورة يحافظ على التدرج والشعار والعنوان
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.dk-stage').click({ position: { x: 90, y: 160 } })]); await fc.setFiles({ name: 'a.jpg', mimeType: 'image/jpeg', buffer: img1 }); await p.waitForTimeout(1200);
  const info = () => p.evaluate(() => { const st = document.querySelector('.dk-stage'); const ov = st.querySelector('.el-photo .ov'); return { ov: ov && ov.getAttribute('style'), logo: !!st.querySelector('.el-img img'), title: (st.querySelector('[data-eid=title] .tx') || {}).textContent, img: !!st.querySelector('.el-photo img') }; });
  const i1 = await info(); ok(i1.img && /linear-gradient/.test(i1.ov) && i1.logo && i1.title === 'عنوان العرض', 'photo applied with official gradient; logo + title intact');
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.dk-props >> text=استبدال الصورة').first().click()]); await fc2.setFiles({ name: 'b.jpg', mimeType: 'image/jpeg', buffer: img2 }); await p.waitForTimeout(1200);
  const i2 = await info(); ok(i2.ov === i1.ov && i2.logo && i2.title === i1.title, 'replace image keeps gradient, logo, title');
  await p.click('.dk-props >> text=تطبيق التدرج الرسمي لهدية'); await p.waitForTimeout(400); ok(/linear-gradient/.test((await info()).ov), 'official gradient button works');

  // 3) النص الطويل لا يخرج عن حدود أي تخطيط رسمي
  const bad = await p.evaluate(() => { const D = window.RBD, out = []; const t = 'عنوان طويل نسبياً يحتوي على عدة كلمات ليختبر ملاءمة النص داخل المساحة المتاحة'; const d160 = 'وصف أطول من المعتاد يشرح فكرة المحور بجملتين أو ثلاث جمل ليتأكد النظام من أن النص لا يخرج عن حدود البطاقة'; for (const l of Object.keys(window.RBS.LAYOUTS)) { const dk = D.createDeck('off-full', { sample: true }); const s = dk.slides.find((x) => x.layout === l); s.title = t; s.subtitle = t; s.bullets = [d160, d160]; (s.items || []).forEach((it) => { it.t = t.slice(0, 50); it.d = d160; it.v = '٩٩٬٩٩٩'; }); const h = document.createElement('div'); h.setAttribute('style', D.rootStyle(dk) + ';position:absolute;left:-9999px'); h.innerHTML = D.renderSlide(dk, s, { config: {}, preview: true, index: 0, total: 1 }); document.body.append(h); h.querySelectorAll('.el-text').forEach((e) => { const x = e.querySelector('.tx'); if (e.classList.contains('over') || (x && x.offsetHeight > e.clientHeight + 3)) out.push(l + ':' + e.dataset.eid); }); h.remove(); } return out; });
  ok(bad.length === 0, 'long text fits in all 16 layouts ' + bad.join(','));

  // 4) الحفظ وإعادة الفتح
  await p.click('#b-save'); await p.waitForTimeout(1200);
  const api1 = await (await p.request.get(base + '/api/decks/' + id)).json();
  const before = await p.locator('.dk-stage').screenshot();
  await p.reload(); await p.waitForSelector('.dk-th'); await p.waitForTimeout(1500);
  const api2 = await (await p.request.get(base + '/api/decks/' + id)).json(); const after = await p.locator('.dk-stage').screenshot();
  ok(JSON.stringify(api1.slides) === JSON.stringify(api2.slides), 'save + reload keeps data identical');
  const d4 = await diff(before, after); ok(d4 < 1.5, 'save + reload keeps design (diff ' + d4.toFixed(2) + '%)');

  // 5) التصدير: صفحة العرض، PDF، PPTX، PNG
  const v = await ctx.newPage(); await v.goto(base + '/decks/' + id + '.html'); await v.waitForSelector('.slide'); await v.waitForTimeout(1500);
  const viewShot = await v.locator('.slide').first().screenshot(); const d5 = await diff(after, viewShot); ok(d5 < 2.5, 'editor == presentation page (diff ' + d5.toFixed(2) + '%)');
  const pdf = await v.pdf({ preferCSSPageSize: true, printBackground: true }); const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length; ok(pages === 16, 'PDF has 16 pages (' + pages + ')');
  const dl = p.waitForEvent('download', { timeout: 90000 }); await p.click('#b-export'); await p.click('.menu >> text=PowerPoint'); const pp = await dl; const pf = path.join(tmp, 'x.pptx'); await pp.saveAs(pf);
  const zip = fs.readFileSync(pf).toString('latin1'); ok((zip.match(/ppt\/slides\/slide\d+\.xml/g) || []).length >= 16 && /\[Content_Types\]/.test(zip), 'PPTX contains 16 slides');
  const png = await p.evaluate(async () => { const m = await import('/js/pptx.js'); const st = await import('/js/store.js'); const cfg = await (await fetch('/api/config')).json(); const b = await m.slidePng(st.store.report, cfg, 0, 1); return b.length; });
  ok(png > 1000, 'PNG export works');
  // ملاحظات المتحدث في PPTX
  const nb64 = await p.evaluate(async () => { const m = await import('/js/pptx.js'); const st = await import('/js/store.js'); const cfg = await (await fetch('/api/config')).json(); const d = JSON.parse(JSON.stringify(st.store.report)); d.slides[0].notes = 'ملاحظة أولى'; d.slides[2].notes = 'ملاحظة ثالثة'; const blob = await m.buildPptx(d, cfg); const u = new Uint8Array(await (blob.arrayBuffer ? blob.arrayBuffer() : new Response(blob).arrayBuffer())); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); });
  const nf = path.join(tmp, 'notes.pptx'); fs.writeFileSync(nf, Buffer.from(nb64, 'base64'));
  try { const r = require('child_process').spawnSync('python3', ['-I', '-c', 'import sys;from pptx import Presentation;p=Presentation(sys.argv[1]);print("|".join(s.notes_slide.notes_text_frame.text if s.has_notes_slide else "-" for s in list(p.slides)[:4]))', nf], { encoding: 'utf8' }); ok(/^ملاحظة أولى\|-\|ملاحظة ثالثة\|-/.test(r.stdout.trim()), 'PPTX speaker notes (' + (r.stdout.trim() || r.stderr.slice(-120)) + ')'); } catch (e) { ok(false, 'PPTX notes ' + e.message); }

  // 6) عدم تراجع الوظائف: قائمة موحّدة، اعتماد
  await p.goto(base + '/list.html?type=deck'); await p.waitForSelector('.ritem'); ok((await p.locator('.ritem').count()) === 1, 'unified list shows the deck');
  ok(errs.length === 0, 'no JS errors ' + errs.slice(0, 2).join('|'));

  await b.close(); srv.kill(); fs.rmSync(tmp, { recursive: true, force: true });
  const f = R.filter((x) => !x).length; console.log(`\n${R.length - f} passed, ${f} failed`); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
