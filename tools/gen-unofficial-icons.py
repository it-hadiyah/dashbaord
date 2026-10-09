#!/usr/bin/env python3
"""يولّد مكتبة «أيقونات غير رسمية» بنفس أسلوب هدية: نسخة بخلفية السداسي (hex) ونسخة بدون خلفية (plain).
الرموز مرسومة على شبكة 24×24 بخط مستدير الأطراف. التشغيل:  python3 tools/gen-unofficial-icons.py"""
import json, os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'brand', 'icons')
TEAL = '#00a094'
HEXPATH = re.search(r'<path class="cls-1" d="([^"]+)"', open(os.path.join(ROOT, 'hex', 'kaaba.svg'), encoding='utf-8').read()).group(1)

C = 'fill="currentColor" stroke="none"'   # عنصر مصمت
def circ(cx, cy, r, solid=False): return f'<circle cx="{cx}" cy="{cy}" r="{r}" {C if solid else ""}/>'
def rect(x, y, w, h, rx=0, solid=False): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" {C if solid else ""}/>'
def path(d, solid=False): return f'<path d="{d}" {C if solid else ""}/>'
HEART = 'M12 20.5S3.5 15.5 3.5 9.2A4.7 4.7 0 0 1 12 6.8a4.7 4.7 0 0 1 8.5 2.4c0 6.3-8.5 11.3-8.5 11.3z'

# (id, التسمية, المجموعة, الرسم)
ICONS = [
 # --- مشاريع ومبادرات ---
 ('project', 'مشروع', 'مشاريع ومبادرات', path('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z') + path('M7 13h10')),
 ('initiative', 'مبادرة', 'مشاريع ومبادرات', path('M12 3c3.2 2 5 5 5 9l-2 3.5H9L7 12c0-4 1.800-7 5-9z') + circ(12, 10, 1.6) + path('M9 15.500l-2 4 3.200-1.200M15 15.500l2 4-3.200-1.200')),
 ('plan', 'خطة', 'مشاريع ومبادرات', rect(5, 4, 14, 17, 2) + rect(9, 2, 6, 4, 1) + path('M9 11h6M9 15h6')),
 ('goal', 'هدف', 'مشاريع ومبادرات', circ(12, 12, 9) + circ(12, 12, 5) + circ(12, 12, 1.600, True)),
 ('milestone', 'مرحلة / معلم', 'مشاريع ومبادرات', path('M5 21V4M5 4h11l-2 4 2 4H5')),
 ('calendar', 'جدول زمني', 'مشاريع ومبادرات', rect(3, 5, 18, 16, 2) + path('M3 10h18M8 3v4M16 3v4') + circ(8, 14.500, 1, True) + circ(12, 14.500, 1, True) + circ(16, 14.500, 1, True)),
 ('task', 'مهمة', 'مشاريع ومبادرات', rect(4, 4, 16, 16, 3.500) + path('M8 12.200l3 3 5-6')),
 ('progress', 'نسبة الإنجاز', 'مشاريع ومبادرات', circ(12, 12, 9) + path('M12 3a9 9 0 0 1 9 9', False).replace('/>', ' stroke-width="3.200"/>')),
 ('proposal', 'اقتراح / فكرة', 'مشاريع ومبادرات', path('M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.500c.8.800 1 1.500 1 2.500h6c0-1 .2-1.700 1-2.500A6 6 0 0 0 12 3z')),
 ('innovation', 'ابتكار', 'مشاريع ومبادرات', path('M12 3l2.200 6.300L21 12l-6.800 2.700L12 21l-2.200-6.300L3 12l6.800-2.700z')),
 ('challenge', 'تحدٍّ / عوائق', 'مشاريع ومبادرات', path('M3 20l6.500-12.500 4 7 2.500-3.500L21 20z')),
 ('risk', 'مخاطر', 'مشاريع ومبادرات', path('M12 3.500l10 17.500H2z') + path('M12 10v5M12 18h.01')),
 ('next', 'الخطوات القادمة', 'مشاريع ومبادرات', circ(12, 12, 9) + path('M13.500 8l-4 4 4 4')),
 ('review', 'مراجعة وتدقيق', 'مشاريع ومبادرات', circ(11, 11, 7) + path('M21 21l-5-5M8 11l2.200 2.200L14 9')),
 ('monitor-eye', 'متابعة ورقابة', 'مشاريع ومبادرات', path('M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z') + circ(12, 12, 3)),
 ('process', 'إجراءات وعمليات', 'مشاريع ومبادرات', circ(12, 12, 3.500) + path('M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M18.700 5.300l-2.100 2.100M7.400 16.600l-2.100 2.100')),
 ('time', 'الوقت / المدة', 'مشاريع ومبادرات', circ(12, 12, 9) + path('M12 7v5l3.500 2')),
 ('partnership', 'شراكة', 'مشاريع ومبادرات', path('M9.500 14.500l-3 3a3 3 0 0 1-4.200-4.200l3-3M14.500 9.500l3-3a3 3 0 0 1 4.200 4.200l-3 3M9 15l6-6')),
 ('team', 'فريق العمل', 'مشاريع ومبادرات', circ(9, 8, 3) + path('M3 20c0-3.300 2.700-5.500 6-5.500s6 2.200 6 5.500') + circ(17, 9, 2.500) + path('M16.500 14.200c2.700 0 4.500 2 4.500 4.800')),
 # --- عناوين التقارير ---
 ('report', 'تقرير', 'عناوين التقارير', path('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z') + path('M14 3v5h5M9 13h6M9 17h6')),
 ('summary', 'ملخص تنفيذي', 'عناوين التقارير', path('M4 6h16M4 10h16M4 14h10M4 18h7')),
 ('intro', 'مقدمة', 'عناوين التقارير', circ(12, 12, 9) + path('M10 8.200l5.500 3.800-5.500 3.800z', True)),
 ('conclusion', 'خلاصة', 'عناوين التقارير', path('M6 3h12v18l-6-4-6 4z')),
 ('recommendation', 'توصيات', 'عناوين التقارير', path('M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6l-4 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z') + path('M8 9h8M8 12.500h5')),
 ('decision', 'قرارات', 'عناوين التقارير', circ(12, 12, 9) + path('M8 12.200l3 3 5-6')),
 ('meeting', 'اجتماع', 'عناوين التقارير', rect(3, 4, 18, 11, 1.500) + path('M12 15v5M8 20h8M7 9h5M7 12h8')),
 ('contract', 'عقد / اتفاقية', 'عناوين التقارير', path('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z') + path('M14 3v5h5M8.500 17c1-2 2-2 3 0s2 1.500 3-.5')),
 ('document-check', 'وثيقة معتمدة', 'عناوين التقارير', path('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z') + path('M14 3v5h5M9 14.500l2 2 4-4.500')),
 ('archive', 'أرشيف', 'عناوين التقارير', path('M3 7h18v13H3z') + path('M3 7l2-3.500h14L21 7M9 12h6')),
 ('numbers', 'أرقام', 'عناوين التقارير', path('M5 9h15M4 15h15M10.500 4L8.500 20M16.500 4l-2 16')),
 ('search', 'بحث ومنهجية', 'عناوين التقارير', circ(11, 11, 7) + path('M21 21l-5-5')),
 ('mail', 'مراسلات', 'عناوين التقارير', rect(3, 5, 18, 14, 2) + path('M3 7.500l9 6 9-6')),
 ('chat', 'تواصل وملاحظات', 'عناوين التقارير', path('M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z')),
 ('announcement', 'إعلام وإعلان', 'عناوين التقارير', path('M3 10.500v3l9 4V6.500zM12 6.500l8-3v17l-8-3M6.500 15.500L8 21h3') ),
 ('phone', 'اتصال', 'عناوين التقارير', path('M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z')),
 ('location', 'الموقع', 'عناوين التقارير', path('M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z') + circ(12, 9, 2.500)),
 ('building', 'المبنى / الفرع', 'عناوين التقارير', rect(5, 3, 14, 18, 1.500) + path('M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M11 21v-3h2v3')),
 ('leadership', 'الإدارة العليا', 'عناوين التقارير', path('M3 8l4.500 4L12 5l4.500 7L21 8l-2 11H5z')),
 # --- إنجازات وأداء ---
 ('trophy', 'إنجازات', 'إنجازات وأداء', path('M7 4h10v5a5 5 0 0 1-10 0z') + path('M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8M10 18h4')),
 ('award', 'جودة وتميّز', 'إنجازات وأداء', circ(12, 9, 6) + path('M8.500 14L7 22l5-3 5 3-1.500-8')),
 ('certificate', 'شهادة', 'إنجازات وأداء', rect(3, 4, 18, 13, 2) + circ(12, 10, 3) + path('M10 17l-1 4 3-2 3 2-1-4')),
 ('star', 'تقييم', 'إنجازات وأداء', path('M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100-4.400-4.300 6.100-.9z')),
 ('satisfaction', 'رضا المستفيدين', 'إنجازات وأداء', circ(12, 12, 9) + path('M8 14c1 1.500 2.500 2.500 4 2.500s3-1 4-2.500') + circ(9, 10, 1, True) + circ(15, 10, 1, True)),
 ('kpi', 'مؤشرات الأداء', 'إنجازات وأداء', path('M4 17a8 8 0 1 1 16 0') + path('M12 17l4-5') + circ(12, 17, 1.500, True)),
 ('stats', 'إحصائيات', 'إنجازات وأداء', path('M4 20V11M10 20V4M16 20v-7M22 20H2')),
 ('pie', 'رسم دائري', 'إنجازات وأداء', circ(12, 12, 9) + path('M12 3v9h9')),
 ('growth', 'نمو', 'إنجازات وأداء', path('M3 17l6-6 4 4 8-8') + path('M15 7h6v6')),
 ('bars-up', 'تطور', 'إنجازات وأداء', path('M4 20h4v-5H4zM10 20h4v-9h-4zM16 20h4V6h-4z', True)),
 ('shield', 'امتثال وحماية', 'إنجازات وأداء', path('M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z') + path('M9 12l2 2 4-4')),
 # --- مالية ---
 ('wallet', 'الميزانية', 'مالية', rect(3, 6, 18, 14, 3) + path('M3 10h18') + circ(16.500, 15, 1.200, True)),
 ('coins', 'مبالغ وتبرعات', 'مالية', circ(12, 12, 9) + circ(12, 12, 5)),
 ('receipt', 'مصروفات', 'مالية', path('M6 3h12v18l-3-2-3 2-3-2-3 2z') + path('M9 8h6M9 12h6')),
 ('revenue', 'إيرادات', 'مالية', path('M3 17l6-6 4 4 8-8') + path('M15 7h6v6') + path('M3 21h18')),
 # --- تقنية ---
 ('monitor', 'تقنية المعلومات', 'تقنية', rect(3, 4, 18, 12, 2) + path('M8 21h8M12 16v5')),
 ('network', 'الشبكات', 'تقنية', circ(12, 5, 2) + circ(5, 19, 2) + circ(19, 19, 2) + path('M12 7v5M12 12l-6 5M12 12l6 5')),
 ('server', 'الخوادم', 'تقنية', rect(3, 4, 18, 6, 2) + rect(3, 14, 18, 6, 2) + circ(7, 7, 0.900, True) + circ(7, 17, 0.900, True)),
 ('database', 'البيانات', 'تقنية', '<ellipse cx="12" cy="6" rx="8" ry="3"/>' + path('M4 6v12c0 1.700 3.600 3 8 3s8-1.300 8-3V6M4 12c0 1.700 3.600 3 8 3s8-1.300 8-3')),
 # --- موارد وبرامج ---
 ('heart', 'المستفيدون', 'موارد وبرامج', path(HEART)),
 ('volunteer', 'المتطوعون', 'موارد وبرامج', circ(12, 6.500, 3) + path('M5 21v-1.500A5.500 5.500 0 0 1 10.500 14h3a5.500 5.500 0 0 1 5.500 5.500V21') + path('M12 19.500s-2.500-1.500-2.500-3.300a1.400 1.400 0 0 1 2.500-.800 1.400 1.400 0 0 1 2.500.800c0 1.800-2.500 3.300-2.500 3.300z', True)),
 ('training', 'التدريب', 'موارد وبرامج', path('M2 9l10-5 10 5-10 5z') + path('M6 11.500V16c0 1.500 3 3 6 3s6-1.500 6-3v-4.500M22 9v6')),
 ('book', 'المعرفة والمحتوى', 'موارد وبرامج', path('M12 6c-2-2-5-3-9-3v14c4 0 7 1 9 3 2-2 5-3 9-3V3c-4 0-7 1-9 3zM12 6v14')),
 ('relief', 'الإغاثة', 'موارد وبرامج', circ(12, 12, 9) + circ(12, 12, 4) + path('M5.700 5.700l3.500 3.500M14.800 14.800l3.500 3.500M18.300 5.700l-3.500 3.500M9.200 14.800l-3.500 3.500')),
 ('water-drop', 'السقيا', 'موارد وبرامج', path('M12 3s7 7 7 12a7 7 0 0 1-14 0c0-5 7-12 7-12z')),
 ('home', 'الإسكان', 'موارد وبرامج', path('M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6')),
 ('bus', 'النقل', 'موارد وبرامج', rect(4, 4, 16, 13, 2.500) + path('M4 11h16M8 17v2.500M16 17v2.500') + circ(8, 14, 0.900, True) + circ(16, 14, 0.900, True)),
 ('health', 'الصحة', 'موارد وبرامج', path(HEART) + path('M5 12h3.500l1.500-2.500 2.500 5 1.500-2.500H19')),
 ('leaf', 'البيئة والاستدامة', 'موارد وبرامج', path('M5 19c0-8.500 5-14 15-14 0 10-6 15-14 15') + path('M5 19c3-3.500 6-6 10-8')),
]

def glyph(markup, color):
    return f'<g color="{color}" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round">{markup}</g>'

for v in ('hex', 'plain'): os.makedirs(os.path.join(ROOT, v), exist_ok=True)
manifest = [m for m in json.load(open(os.path.join(ROOT, 'index.json'), encoding='utf-8')) if m.get('category', 'official') == 'official']
for m in manifest: m['category'] = 'official'
for id_, label, group, markup in ICONS:
    sid = 'u-' + id_
    plain = f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">{glyph(markup, "#00a092")}</svg>\n'
    hexs = (f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.7 5.35"><path fill="{TEAL}" d="{HEXPATH}"/>'
            f'<svg x="1.050" y="1.350" width="2.600" height="2.600" viewBox="0 0 24 24">{glyph(markup, "#fff")}</svg></svg>\n')
    for s in (plain, hexs): assert not re.search(r'<script|on\w+=|href=|foreignObject', s, re.I)
    open(os.path.join(ROOT, 'plain', sid + '.svg'), 'w', encoding='utf-8').write(plain)
    open(os.path.join(ROOT, 'hex', sid + '.svg'), 'w', encoding='utf-8').write(hexs)
    manifest.append({'id': sid, 'label': label, 'hex': True, 'plain': True, 'category': 'unofficial', 'group': group})
json.dump(manifest, open(os.path.join(ROOT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('official', sum(1 for m in manifest if m['category'] == 'official'), 'unofficial', sum(1 for m in manifest if m['category'] == 'unofficial'))
