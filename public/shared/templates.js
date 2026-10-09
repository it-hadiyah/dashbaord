/* مكتبة القوالب ونموذج البيانات الموحّد (تعمل في المتصفح وعلى الخادم).
   القالب يحدد الشكل (الغلاف، الألوان، العناوين) والأقسام الافتراضية، أما محتوى التقرير فيُحفظ منفصلاً عنه،
   لذلك يمكن تغيير القالب في أي وقت دون فقدان المحتوى. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RBT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PALETTES = {
    hadiyah: { a: '#007f73', d: '#005a52', s: '#e0f4f1', x: '#02a999', name: 'هدية' },
    green: { a: '#1f7a5c', d: '#145a43', s: '#e6f4ee', x: '#3cc79a', name: 'أخضر الجمعية' },
    navy: { a: '#23406e', d: '#16294a', s: '#e8eef8', x: '#5b8fd9', name: 'كحلي' },
    teal: { a: '#0f766e', d: '#0b524d', s: '#e0f2f1', x: '#2dd4bf', name: 'تركوازي' },
    sand: { a: '#9a6b12', d: '#6b4a0c', s: '#fbf3e1', x: '#e0b04a', name: 'رملي' },
    plum: { a: '#7a3b6e', d: '#55284c', s: '#f6eaf3', x: '#c77bb8', name: 'برقوقي' },
    slate: { a: '#1e293b', d: '#0f172a', s: '#e9edf3', x: '#38bdf8', name: 'رمادي داكن' },
  };

  const BLOCKS = {
    text: { name: 'نص وعناوين', icon: 'type', desc: 'فقرات، عناوين، قوائم وتنسيق غني' },
    list: { name: 'قائمة نقاط', icon: 'list', desc: 'نقاط مرتبة أو غير مرتبة' },
    table: { name: 'جدول', icon: 'table', desc: 'جدول قابل للتحرير' },
    kpi: { name: 'مؤشرات وبطاقات', icon: 'gauge', desc: 'بطاقات KPI وإحصاءات بارزة' },
    chart: { name: 'رسم بياني', icon: 'chart', desc: 'أعمدة، خط، مساحة، دائري' },
    progress: { name: 'مؤشرات تقدم', icon: 'progress', desc: 'أشرطة نسب الإنجاز' },
    timeline: { name: 'خط زمني', icon: 'timeline', desc: 'مراحل ومعالم زمنية' },
    image: { name: 'صورة / شعار', icon: 'image', desc: 'رفع صورة مع تعليق' },
    callout: { name: 'ملاحظة بارزة', icon: 'callout', desc: 'تنبيه أو خلاصة مميزة' },
    pagebreak: { name: 'فاصل صفحة', icon: 'pagebreak', desc: 'بدء صفحة جديدة' },
  };

  const TYPES = Object.keys(BLOCKS);
  let seq = 0;
  const uid = () => 's' + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);

  function emptyContent(type, preset) {
    switch (type) {
      case 'text': return '';
      case 'list': return { ordered: false, items: [''] };
      case 'table': {
        const h = preset && preset.headers ? preset.headers.slice() : ['', '', ''];
        return { headers: h, rows: [Array(h.length).fill(''), Array(h.length).fill('')], zebra: true };
      }
      case 'kpi': return { style: 'cards', items: (preset && preset.labels ? preset.labels : ['', '', '']).map((label) => ({ label, value: '', trend: '' })) };
      case 'chart': return { kind: (preset && preset.kind) || 'bar', unit: '', data: [{ label: '', value: '' }, { label: '', value: '' }, { label: '', value: '' }] };
      case 'progress': return { items: (preset && preset.labels ? preset.labels : ['', '']).map((label) => ({ label, value: '' })) };
      case 'timeline': return { items: [{ date: '', title: '', desc: '', status: 'todo' }, { date: '', title: '', desc: '', status: 'todo' }] };
      case 'image': return { src: '', caption: '', fit: 'contain', height: 220 };
      case 'callout': return { tone: 'info', text: '' };
      default: return {};
    }
  }

  function makeSection(type, title, o) {
    o = o || {};
    return {
      id: uid(), type, title: title || '', visible: true, width: o.width || 'full',
      hint: o.hint || '',
      content: o.sample && o.useSample ? JSON.parse(JSON.stringify(o.sample)) : emptyContent(type, o),
    };
  }

  // اختصار لتعريف قسم داخل قالب
  const sec = (type, title, hint, extra) => Object.assign({ type, title, hint }, extra || {});
  const K = (label, value, trend) => ({ label, value, trend: trend || '' });

  const TEMPLATES = [
    {
      id: 'annual', name: 'التقرير السنوي المؤسسي', category: 'إدارية', cover: 'hero', palette: 'hadiyah', head: 'bar',
      desc: 'غلاف راقٍ وإنجازات ومؤشرات ورسوم بيانية لعام كامل.', toc: true, closing: true,
      sampleTitle: 'التقرير السنوي', sampleSub: 'حصاد عام من العطاء',
      sections: [
        sec('text', 'كلمة رئيس مجلس الإدارة', 'اكتب كلمة قصيرة تلخص مسيرة العام ورؤية المرحلة القادمة.', { sample: '<p>شهد هذا العام نمواً ملحوظاً في برامج الجمعية ومستفيديها، ونتطلع لمزيد من العطاء في العام القادم.</p>' }),
        sec('kpi', 'أبرز الأرقام', 'أدخل أهم الأرقام الرئيسية للعام مع نسبة تغيّرها عن العام السابق.', { labels: ['المستفيدون', 'البرامج', 'المتطوعون', 'الشراكات'], sample: { style: 'cards', items: [K('المستفيدون', '12,450', '+18%'), K('البرامج', '34', '+6%'), K('المتطوعون', '860', '+12%'), K('الشراكات', '27', '+4%')] } }),
        sec('chart', 'نمو المستفيدين الشهري', 'أدخل عدد المستفيدين لكل شهر أو ربع.', { kind: 'area', width: 'half', sample: { kind: 'area', unit: '', data: [{ label: 'الربع 1', value: '2400' }, { label: 'الربع 2', value: '3100' }, { label: 'الربع 3', value: '3300' }, { label: 'الربع 4', value: '3650' }] } }),
        sec('chart', 'توزيع الإنفاق على البرامج', 'أدخل نسبة أو مبلغ كل برنامج.', { kind: 'donut', width: 'half', sample: { kind: 'donut', unit: '', data: [{ label: 'الرعاية', value: '45' }, { label: 'التعليم', value: '25' }, { label: 'الصحة', value: '20' }, { label: 'أخرى', value: '10' }] } }),
        sec('timeline', 'محطات العام', 'اذكر أهم المحطات والإنجازات مرتبة زمنياً.', { sample: { items: [{ date: 'يناير', title: 'إطلاق الخطة السنوية', desc: '', status: 'done' }, { date: 'يونيو', title: 'اعتماد الشراكة الاستراتيجية', desc: '', status: 'done' }, { date: 'ديسمبر', title: 'ختام العام وتقييم الأثر', desc: '', status: 'active' }] } }),
        sec('text', 'الخطة المستقبلية', 'ما أهم أهداف العام القادم؟', { sample: '<p>توسيع نطاق الخدمات، وتعزيز الشراكات، ورفع كفاءة التشغيل.</p>' }),
      ],
    },
    {
      id: 'executive', name: 'التقرير التنفيذي للإدارة العليا', category: 'إدارية', cover: 'minimal', palette: 'navy', head: 'underline',
      desc: 'ملخص تنفيذي وقرارات وتوصيات مختصرة لاتخاذ القرار.', toc: false, closing: false,
      sampleTitle: 'التقرير التنفيذي', sampleSub: 'ملخص للإدارة العليا',
      sections: [
        sec('callout', 'الخلاصة', 'اكتب الخلاصة في جملتين: أهم ما يجب أن تعرفه الإدارة.', { sample: { tone: 'info', text: 'سارت المشاريع الرئيسية وفق الخطة، مع حاجة لقرار بشأن زيادة الميزانية.' } }),
        sec('kpi', 'مؤشرات رئيسية', 'أدخل أهم 3 إلى 4 مؤشرات.', { labels: ['الإنجاز العام', 'الميزانية المصروفة', 'المخاطر العالية'], sample: { style: 'cards', items: [K('الإنجاز العام', '82%', '+5%'), K('الميزانية المصروفة', '64%', ''), K('المخاطر العالية', '2', '-1')] } }),
        sec('text', 'أبرز الإنجازات', 'لخّص أبرز ما تحقق في الفترة.', { sample: '<ul><li>اكتمال المرحلة الأولى قبل الموعد.</li><li>توقيع اتفاقية جديدة.</li></ul>' }),
        sec('table', 'القرارات المطلوبة', 'اذكر كل قرار مطلوب ومن المسؤول والموعد.', { headers: ['القرار', 'المسؤول', 'الموعد'], sample: { headers: ['القرار', 'المسؤول', 'الموعد'], zebra: true, rows: [['اعتماد زيادة الميزانية', 'الإدارة المالية', 'نهاية الشهر'], ['الموافقة على التوسع', 'الإدارة العليا', 'الربع القادم']] } }),
        sec('text', 'التوصيات', 'ما توصيتك للإدارة؟'),
      ],
    },
    {
      id: 'monthly', name: 'التقرير الشهري للإدارات', category: 'إدارية', cover: 'band', palette: 'teal', head: 'bar',
      desc: 'متابعة شهرية لأداء كل إدارة: مهام، مؤشرات، وتحديات.', toc: false, closing: false,
      sampleTitle: 'التقرير الشهري', sampleSub: 'أداء الإدارة خلال الشهر',
      sections: [
        sec('text', 'ملخص الشهر', 'لخّص الشهر في فقرة قصيرة.', { sample: '<p>أنجزت الإدارة غالبية المهام المخططة مع تحسن في زمن الاستجابة.</p>' }),
        sec('kpi', 'مؤشرات الشهر', 'أدخل أرقام الشهر الرئيسية.', { labels: ['المهام المنجزة', 'قيد التنفيذ', 'متأخرة'], sample: { style: 'cards', items: [K('المهام المنجزة', '42', '+9%'), K('قيد التنفيذ', '11', ''), K('متأخرة', '3', '-2')] } }),
        sec('table', 'المهام والإنجازات', 'سجّل المهام التي عملت عليها وحالتها.', { headers: ['المهمة', 'المسؤول', 'الحالة'], sample: { headers: ['المهمة', 'المسؤول', 'الحالة'], zebra: true, rows: [['تحديث الإجراءات', 'أحمد', 'مكتملة'], ['إعداد التقرير الربعي', 'سارة', 'قيد التنفيذ']] } }),
        sec('progress', 'نسب إنجاز الخطة', 'أدخل نسبة إنجاز كل محور من الخطة.', { labels: ['المحور الأول', 'المحور الثاني', 'المحور الثالث'], sample: { items: [{ label: 'المحور الأول', value: '90' }, { label: 'المحور الثاني', value: '65' }, { label: 'المحور الثالث', value: '40' }] } }),
        sec('list', 'التحديات', 'ما التحديات التي واجهتكم؟'),
        sec('list', 'خطة الشهر القادم', 'ما المخطط تنفيذه الشهر القادم؟'),
      ],
    },
    {
      id: 'kpi', name: 'تقرير الأداء ومؤشرات KPI', category: 'إدارية', cover: 'split', palette: 'sand', head: 'pill',
      desc: 'لوحة مؤشرات أداء مع رسوم ومقارنات.', toc: false, closing: false,
      sampleTitle: 'تقرير الأداء', sampleSub: 'مؤشرات الأداء الرئيسية',
      sections: [
        sec('kpi', 'المؤشرات الرئيسية', 'أدخل أهم مؤشرات الأداء مع تغيّرها.', { labels: ['مؤشر 1', 'مؤشر 2', 'مؤشر 3', 'مؤشر 4'], sample: { style: 'highlights', items: [K('رضا المستفيدين', '94%', '+3%'), K('زمن الاستجابة', '2.1 ساعة', '-12%'), K('تحقيق الأهداف', '88%', '+6%'), K('كفاءة التشغيل', '91%', '+2%')] } }),
        sec('chart', 'الأداء مقابل المستهدف', 'أدخل القيمة الفعلية لكل فترة.', { kind: 'bar', width: 'half', sample: { kind: 'bar', unit: '', data: [{ label: 'يناير', value: '70' }, { label: 'فبراير', value: '78' }, { label: 'مارس', value: '85' }, { label: 'أبريل', value: '88' }] } }),
        sec('chart', 'اتجاه الأداء', 'أدخل القيم بالترتيب الزمني.', { kind: 'line', width: 'half', sample: { kind: 'line', unit: '', data: [{ label: 'يناير', value: '70' }, { label: 'فبراير', value: '78' }, { label: 'مارس', value: '85' }, { label: 'أبريل', value: '88' }] } }),
        sec('progress', 'تحقق الأهداف', 'أدخل نسبة تحقق كل هدف.', { labels: ['الهدف 1', 'الهدف 2', 'الهدف 3'] }),
        sec('table', 'جدول المقارنة', 'قارن بين المستهدف والفعلي.', { headers: ['المؤشر', 'المستهدف', 'الفعلي', 'الفرق'] }),
        sec('text', 'تحليل وتوصيات', 'ما قراءتك للأرقام؟ وما توصياتك؟'),
      ],
    },
    {
      id: 'projects', name: 'تقرير المشاريع والمبادرات', category: 'إدارية', cover: 'side', palette: 'plum', head: 'bar',
      desc: 'حالة المشاريع والمبادرات ومراحلها ومخاطرها.', toc: false, closing: false,
      sampleTitle: 'تقرير المشاريع', sampleSub: 'حالة المشاريع والمبادرات',
      sections: [
        sec('text', 'نبذة عن المشروع', 'ما المشروع؟ وما هدفه والجهة المستفيدة؟', { sample: '<p>مشروع لتطوير الخدمات الرقمية للمستفيدين خلال عام.</p>' }),
        sec('kpi', 'مؤشرات المشروع', 'الحالة، نسبة الإنجاز، الميزانية.', { labels: ['الحالة', 'نسبة الإنجاز', 'الميزانية المصروفة'], sample: { style: 'cards', items: [K('الحالة', 'يسير وفق الخطة', ''), K('نسبة الإنجاز', '68%', '+8%'), K('الميزانية المصروفة', '52%', '')] } }),
        sec('timeline', 'المراحل والمعالم', 'اذكر المراحل وحالة كل مرحلة.', { sample: { items: [{ date: 'الربع 1', title: 'التخطيط', desc: '', status: 'done' }, { date: 'الربع 2', title: 'التنفيذ', desc: '', status: 'active' }, { date: 'الربع 3', title: 'الإطلاق', desc: '', status: 'todo' }] } }),
        sec('table', 'المهام', 'سجّل مهام المشروع ومن المسؤول عن كل مهمة وحالتها.', { headers: ['المهمة', 'المسؤول', 'الحالة', 'الإنجاز'] }),
        sec('table', 'المخاطر والعوائق', 'ما المخاطر؟ وما إجراء المعالجة؟', { headers: ['الخطر', 'الأثر', 'إجراء المعالجة'] }),
        sec('text', 'الخطوات القادمة', 'ما سيتم عمله في المرحلة التالية؟'),
      ],
    },
    {
      id: 'it', name: 'تقرير تقنية المعلومات', category: 'تقنية', cover: 'band', palette: 'navy', head: 'underline',
      desc: 'التذاكر وجاهزية الأنظمة والمشاريع والأداء.', toc: false, closing: false,
      sampleTitle: 'تقرير تقنية المعلومات', sampleSub: 'الأنظمة والدعم والمشاريع',
      sections: [
        sec('kpi', 'مؤشرات الخدمة', 'أدخل أرقام الدعم الفني وجاهزية الأنظمة.', { labels: ['جاهزية الأنظمة', 'التذاكر المغلقة', 'زمن الحل'], sample: { style: 'cards', items: [K('جاهزية الأنظمة', '99.7%', '+0.2%'), K('التذاكر المغلقة', '318', '+14%'), K('متوسط زمن الحل', '3.2 ساعة', '-9%')] } }),
        sec('chart', 'التذاكر حسب الفئة', 'أدخل عدد التذاكر لكل فئة.', { kind: 'hbar', width: 'half', sample: { kind: 'hbar', unit: '', data: [{ label: 'الشبكات', value: '64' }, { label: 'البرامج', value: '120' }, { label: 'الأجهزة', value: '88' }, { label: 'الحسابات', value: '46' }] } }),
        sec('chart', 'التذاكر الشهرية', 'أدخل عدد التذاكر لكل شهر.', { kind: 'line', width: 'half' }),
        sec('table', 'حالة الأنظمة', 'اذكر كل نظام وحالته وآخر صيانة.', { headers: ['النظام', 'الحالة', 'آخر صيانة'] }),
        sec('table', 'مشاريع التقنية', 'اذكر المشاريع وحالتها.', { headers: ['المشروع', 'الحالة', 'الإنجاز'] }),
        sec('text', 'التحديات والتوصيات', 'ما التحديات؟ وما المطلوب لمعالجتها؟'),
      ],
    },
    {
      id: 'cyber', name: 'تقرير الأمن السيبراني والامتثال', category: 'تقنية', cover: 'hero', palette: 'slate', head: 'bar',
      desc: 'مستوى الامتثال والمخاطر وخطط المعالجة.', toc: false, closing: false,
      sampleTitle: 'تقرير الأمن السيبراني', sampleSub: 'مستوى الامتثال والمخاطر',
      sections: [
        sec('kpi', 'مستوى الامتثال', 'أدخل نسب الامتثال الرئيسية.', { labels: ['نسبة الامتثال', 'الحوادث', 'الثغرات المفتوحة'], sample: { style: 'highlights', items: [K('نسبة الامتثال', '87%', '+4%'), K('الحوادث', '5', '-3'), K('الثغرات المفتوحة', '12', '-6')] } }),
        sec('progress', 'الامتثال حسب المحور', 'أدخل نسبة الامتثال لكل محور.', { labels: ['الحوكمة', 'الحماية', 'الصمود'], sample: { items: [{ label: 'الحوكمة', value: '92' }, { label: 'الحماية', value: '84' }, { label: 'الصمود', value: '78' }] } }),
        sec('chart', 'الحوادث حسب النوع', 'أدخل عدد الحوادث لكل نوع.', { kind: 'donut', width: 'half' }),
        sec('table', 'سجل المخاطر', 'اذكر المخاطر وأولويتها وخطة المعالجة.', { headers: ['الخطر', 'الأولوية', 'خطة المعالجة', 'الموعد'] }),
        sec('text', 'ملاحظات المراجعة', 'أي ملاحظات من المراجعة أو التدقيق.'),
        sec('callout', 'التوصية الرئيسية', 'ما أهم توصية؟'),
      ],
    },
    {
      id: 'finance', name: 'التقرير المالي', category: 'مالية', cover: 'minimal', palette: 'sand', head: 'underline',
      desc: 'الإيرادات والمصروفات والميزانية والتحليل المالي.', toc: false, closing: false,
      sampleTitle: 'التقرير المالي', sampleSub: 'الإيرادات والمصروفات',
      sections: [
        sec('kpi', 'الملخص المالي', 'أدخل الإيرادات والمصروفات والفائض.', { labels: ['الإيرادات', 'المصروفات', 'الفائض'], sample: { style: 'cards', items: [K('الإيرادات', '4.8M', '+12%'), K('المصروفات', '4.1M', '+5%'), K('الفائض', '0.7M', '+31%')] } }),
        sec('chart', 'الإيرادات الشهرية', 'أدخل الإيراد لكل شهر.', { kind: 'bar', width: 'half' }),
        sec('chart', 'توزيع المصروفات', 'أدخل مصروف كل بند.', { kind: 'donut', width: 'half' }),
        sec('table', 'الميزانية مقابل الفعلي', 'قارن المعتمد بالفعلي لكل بند.', { headers: ['البند', 'المعتمد', 'الفعلي', 'الفرق'] }),
        sec('text', 'التحليل المالي', 'اشرح أسباب الفروقات الرئيسية.'),
        sec('callout', 'ملاحظة للإدارة', 'أي أمر مالي يحتاج انتباه الإدارة.'),
      ],
    },
    {
      id: 'hr', name: 'تقرير الموارد البشرية', category: 'موارد', cover: 'side', palette: 'teal', head: 'pill',
      desc: 'الموظفون والتوظيف والتدريب والرضا الوظيفي.', toc: false, closing: false,
      sampleTitle: 'تقرير الموارد البشرية', sampleSub: 'الكوادر والتطوير',
      sections: [
        sec('kpi', 'مؤشرات الموارد البشرية', 'عدد الموظفين والتعيينات والدوران.', { labels: ['عدد الموظفين', 'التعيينات', 'معدل الدوران'] }),
        sec('chart', 'الموظفون حسب الإدارة', 'أدخل عدد الموظفين لكل إدارة.', { kind: 'hbar', width: 'half' }),
        sec('chart', 'ساعات التدريب', 'أدخل ساعات التدريب لكل ربع.', { kind: 'bar', width: 'half' }),
        sec('table', 'التوظيف والوظائف الشاغرة', 'اذكر الوظائف وحالة التعيين.', { headers: ['الوظيفة', 'الإدارة', 'الحالة'] }),
        sec('progress', 'الرضا الوظيفي', 'أدخل نسب الرضا لكل محور.', { labels: ['بيئة العمل', 'التطوير', 'التقدير'] }),
        sec('text', 'ملاحظات وتوصيات', 'ما التوصيات؟'),
      ],
    },
    {
      id: 'programs', name: 'تقرير البرامج والخدمات', category: 'إدارية', cover: 'split', palette: 'hadiyah', head: 'bar',
      desc: 'البرامج المنفذة والمستفيدون ومستوى الجودة.', toc: false, closing: false,
      sampleTitle: 'تقرير البرامج والخدمات', sampleSub: 'الأداء والمستفيدون',
      sections: [
        sec('kpi', 'حصاد البرامج', 'عدد البرامج والمستفيدين والساعات.', { labels: ['البرامج المنفذة', 'المستفيدون', 'ساعات العمل'] }),
        sec('chart', 'المستفيدون حسب البرنامج', 'أدخل عدد المستفيدين لكل برنامج.', { kind: 'bar', width: 'half' }),
        sec('chart', 'توزيع المستفيدين', 'أدخل التوزيع حسب الفئة.', { kind: 'donut', width: 'half' }),
        sec('table', 'تفاصيل البرامج', 'اذكر كل برنامج وتاريخه وعدد مستفيديه.', { headers: ['البرنامج', 'التاريخ', 'المستفيدون', 'التقييم'] }),
        sec('text', 'قصص نجاح', 'اذكر قصة أو أكثر تعكس الأثر.'),
        sec('text', 'الدروس المستفادة', 'ما الذي تعلمتموه؟'),
      ],
    },
    {
      id: 'impact', name: 'تقرير قياس الأثر', category: 'تأثير', cover: 'hero', palette: 'plum', head: 'underline',
      desc: 'قياس الأثر الاجتماعي بالمدخلات والمخرجات والنتائج.', toc: true, closing: true,
      sampleTitle: 'تقرير قياس الأثر', sampleSub: 'من المخرجات إلى الأثر',
      sections: [
        sec('text', 'منهجية القياس', 'كيف قسّتم الأثر؟ وما الأدوات المستخدمة؟'),
        sec('kpi', 'مؤشرات الأثر', 'أدخل أهم مؤشرات الأثر.', { labels: ['الأثر الرئيسي', 'نسبة التحسن', 'عدد المتأثرين'], sample: { style: 'highlights', items: [K('الأسر المستقرة', '1,240', '+22%'), K('نسبة التحسن', '71%', '+9%'), K('المتأثرون', '5,800', '+15%')] } }),
        sec('chart', 'قبل وبعد البرنامج', 'قارن القيم قبل البرنامج وبعده.', { kind: 'bar', width: 'half' }),
        sec('progress', 'تحقق النتائج', 'أدخل نسبة تحقق كل نتيجة.', { labels: ['النتيجة 1', 'النتيجة 2', 'النتيجة 3'], width: 'half' }),
        sec('text', 'قصص الأثر', 'اذكر قصصاً ملهمة بإذن أصحابها.'),
        sec('text', 'التوصيات', 'كيف نضاعف الأثر؟'),
      ],
    },
    {
      id: 'results', name: 'تقرير الإنجازات والنتائج', category: 'إدارية', cover: 'band', palette: 'hadiyah', head: 'pill',
      desc: 'ما أُنجز من مهام ومبادرات وما تحقق من نتائج.', toc: false, closing: false,
      sampleTitle: 'تقرير الإنجازات والنتائج', sampleSub: 'ما أُنجز وما تحقق',
      sections: [
        sec('text', 'نظرة عامة', 'لخّص الفترة وأبرز ما تحقق فيها.'),
        sec('kpi', 'النتائج بالأرقام', 'أدخل أبرز النتائج المحققة.', { labels: ['مهام منجزة', 'مبادرات', 'نسبة الإنجاز'] }),
        sec('list', 'أبرز الإنجازات', 'اكتب كل إنجاز في سطر مستقل.'),
        sec('timeline', 'خط الإنجاز', 'ضع الإنجازات على خط زمني.'),
        sec('list', 'التحديات', 'ما التحديات؟'),
        sec('text', 'الخطوات القادمة', 'ما التالي؟'),
      ],
    },
    {
      id: 'meeting', name: 'تقرير اجتماع الإدارات', category: 'إدارية', cover: 'minimal', palette: 'teal', head: 'bar',
      desc: 'محضر اجتماع: الحضور والنقاش والقرارات والتوصيات.', toc: false, closing: false,
      sampleTitle: 'تقرير اجتماع', sampleSub: 'محضر اجتماع الإدارات',
      sections: [
        sec('kpi', 'بيانات الاجتماع', 'التاريخ والمكان وعدد الحضور.', { labels: ['التاريخ', 'المكان', 'عدد الحضور'] }),
        sec('list', 'الحضور', 'اكتب اسم كل حاضر في سطر.'),
        sec('list', 'جدول الأعمال', 'ما البنود التي نوقشت؟', { ordered: true }),
        sec('text', 'ملخص النقاش', 'لخّص أهم ما دار في الاجتماع.'),
        sec('table', 'القرارات والتوصيات', 'سجّل القرار والمسؤول والموعد.', { headers: ['القرار', 'المسؤول', 'الموعد'] }),
      ],
    },
    {
      id: 'blank', name: 'تقرير فارغ', category: 'عام', cover: 'band', palette: 'hadiyah', head: 'bar',
      desc: 'ابدأ من الصفر وأضف الأقسام التي تحتاجها.', toc: false, closing: false,
      sampleTitle: 'عنوان التقرير', sampleSub: '',
      sections: [sec('text', 'المقدمة', 'اكتب مقدمة قصيرة عن موضوع التقرير.')],
    },
  ];

  const CATEGORIES = ['الكل', 'إدارية', 'تقنية', 'مالية', 'موارد', 'تأثير', 'عام'];
  const byId = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[TEMPLATES.length - 1];

  const DEFAULT_OPTIONS = { cover: true, toc: false, closing: false, header: true, pageNumbers: true, margins: 'normal', footerText: '' };

  function createReport(templateId, opts) {
    opts = opts || {};
    const t = byId(templateId);
    return {
      version: 2, id: null, template: t.id, sample: !!opts.sample,
      title: opts.sample ? t.sampleTitle : '', subtitle: opts.sample ? t.sampleSub : '',
      period: opts.sample ? 'الفترة: 2026' : '', employee: '', department: '', date: new Date().toISOString().slice(0, 10),
      palette: t.palette,
      options: Object.assign({}, DEFAULT_OPTIONS, { toc: !!t.toc, closing: !!t.closing }),
      sections: t.sections.map((s) => makeSection(s.type, s.title, Object.assign({}, s, { useSample: !!opts.sample }))),
    };
  }

  // ترقية بيانات الإصدار الأول (version 1) إلى النموذج الحالي
  function migrate(d) {
    if (d && d.version === 2) return d;
    const r = createReport('blank');
    r.id = d.id || null;
    r.title = d.title || ''; r.employee = d.employee || ''; r.department = d.department || ''; r.date = d.date || r.date;
    r.legacyType = d.type || '';
    r.sections = (d.sections || []).map((s) => {
      const sec2 = makeSection(s.type === 'chart' || s.type === 'kpi' || s.type === 'table' || s.type === 'list' ? s.type : 'text', s.title);
      sec2.width = s.width === 'half' ? 'half' : 'full';
      if (s.type === 'list') sec2.content = { ordered: false, items: Array.isArray(s.content) ? s.content : [] };
      else if (s.type === 'kpi') sec2.content = { style: 'cards', items: Array.isArray(s.content) ? s.content : [] };
      else if (s.type === 'table') sec2.content = { headers: (s.content && s.content.headers) || [], rows: (s.content && s.content.rows) || [], zebra: true };
      else if (s.type === 'chart') sec2.content = { kind: (s.content && s.content.kind) || 'bar', unit: '', data: (s.content && s.content.data) || [] };
      else sec2.content = '<p>' + String(s.content || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\r?\n/g, '<br>') + '</p>';
      return sec2;
    });
    return r;
  }

  return { PALETTES, BLOCKS, TYPES, TEMPLATES, CATEGORIES, DEFAULT_OPTIONS, byId, uid, emptyContent, makeSection, createReport, migrate };
});
