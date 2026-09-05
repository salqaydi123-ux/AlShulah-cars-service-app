export type Lang = 'ar' | 'en';

// مفتاح مشترك بكل الصفحات (الرئيسية + /admin/finance) — يضمن اختيار اللغة بصفحة التشغيل
// الرئيسية ينعكس تلقائياً عند الدخول لصفحة الشؤون المالية، بدون أي مزامنة إضافية.
export const LANG_STORAGE_KEY = 'alshulah_lang';

export const EMIRATES_EN: Record<string, string> = {
  'الشارقة': 'Sharjah',
  'دبي': 'Dubai',
  'أبوظبي': 'Abu Dhabi',
  'عجمان': 'Ajman',
  'أم القيوين': 'Umm Al Quwain',
  'رأس الخيمة': 'Ras Al Khaimah',
  'الفجيرة': 'Fujairah',
};

export function emirateLabel(emirate: string, lang: Lang): string {
  if (emirate === 'other') return lang === 'en' ? 'Other Country' : 'دولة أخرى';
  return lang === 'en' ? EMIRATES_EN[emirate] || emirate : emirate;
}

export const BODY_LABEL_BY_LANG: Record<Lang, Record<string, string>> = {
  ar: { sedan: 'صالون', fourwd: 'فورويل / SUV / بيك أب' },
  en: { sedan: 'Sedan', fourwd: '4WD / SUV / Pickup' },
};

export const PAY_STATUS_LABEL_BY_LANG: Record<Lang, Record<string, string>> = {
  ar: { paid: 'مسدد', pending: 'آجل — غير مسدد' },
  en: { paid: 'Paid', pending: 'Pending — Unpaid' },
};

export const PAY_METHOD_LABEL_BY_LANG: Record<Lang, Record<string, string>> = {
  ar: { 'نقدي': 'نقدي (الآن)', 'بطاقة': 'بطاقة (الآن)', 'آجل': 'آجل (لحين السداد)', 'محصّل لاحقاً': 'محصّل لاحقاً' },
  en: { 'نقدي': 'Cash (Now)', 'بطاقة': 'Card (Now)', 'آجل': 'Deferred (Pending)', 'محصّل لاحقاً': 'Collected Later' },
};

// نفس طرق الدفع، بدون لاحقة "(الآن)"/"(لحين السداد)" الخاصة بفورم التسجيل — تُستخدم بعرض عمليات سابقة (التقرير المالي).
export const PAY_METHOD_PLAIN_LABEL_BY_LANG: Record<Lang, Record<string, string>> = {
  ar: { 'نقدي': 'نقدي', 'بطاقة': 'بطاقة', 'آجل': 'آجل', 'محصّل لاحقاً': 'محصّل لاحقاً' },
  en: { 'نقدي': 'Cash', 'بطاقة': 'Card', 'آجل': 'Deferred', 'محصّل لاحقاً': 'Collected Later' },
};

export const COMPENSATION_LABEL_BY_LANG: Record<Lang, Record<string, string>> = {
  ar: { fixed: 'راتب ثابت', revenue_share: 'نسبة من الدخل', fixed_plus_profit_share: 'ثابت + نسبة أرباح' },
  en: { fixed: 'Fixed salary', revenue_share: 'Revenue share', fixed_plus_profit_share: 'Fixed + profit share' },
};

export const ACCOUNT_TYPE_LABEL_BY_LANG: Record<Lang, Record<string, string>> = {
  ar: { revenue: 'إيراد', expense: 'مصروف' },
  en: { revenue: 'Revenue', expense: 'Expense' },
};

export const REPORT_PRESET_LABEL_BY_LANG: Record<Lang, Record<'yesterday' | 'last7' | 'thisMonth' | 'lastMonth', string>> = {
  ar: { yesterday: 'أمس', last7: 'آخر 7 أيام', thisMonth: 'هذا الشهر', lastMonth: 'الشهر الماضي' },
  en: { yesterday: 'Yesterday', last7: 'Last 7 days', thisMonth: 'This month', lastMonth: 'Last month' },
};

// نص عربي (مصدر الحقيقة الافتراضي) -> ترجمة إنجليزية. أي نص جديد بالواجهة يُضاف هنا.
const DICT: Record<string, string> = {
  'الشعلة لخدمة السيارات': 'AL SHULAH CARS SERVICE',
  'AL SHULAH CARS SERVICE — كلباء': 'الشعلة لخدمة السيارات — Kalba',
  'سيارات اليوم': 'Cars Today',
  'الإعدادات': 'Settings',
  'خروج': 'Logout',

  'بحث سريع': 'Quick Search',
  'برقم الجوال': 'By Phone',
  'برقم اللوحة': 'By Plate',
  'بحث': 'Search',
  'الرمز': 'Code',
  'الرقم': 'Number',
  'اسم الدولة': 'Country name',

  'بيانات العميل': 'Customer Info',
  'رقم الجوال': 'Phone Number',
  'اسم العميل (اختياري)': 'Customer Name (optional)',
  'يمكن تخطيه — رقم الجوال كافٍ للتعريف': 'Optional — the phone number is enough to identify the customer',

  'بيانات السيارة': 'Vehicle Info',
  'رقم اللوحة': 'Plate Number',
  'اسم الدولة (مثال: عُمان)': 'Country name (e.g. Oman)',
  'بدون لوحة (سيارة معرض / وارد للبيع)': 'No plate (showroom / import for sale)',
  'نوع/موديل السيارة (اختياري)': 'Car Model (optional)',
  'مثال: تويوتا كامري': 'e.g. Toyota Camry',
  'نوع الهيكل (يحدد السعر تلقائياً)': 'Body Type (auto-sets the price)',

  'الغسيل الأساسي': 'Basic Wash',
  'نوع الغسيل (السعر يظهر تلقائياً حسب نوع الهيكل)': 'Wash Type (price shows automatically by body type)',
  'بدون غسيل أساسي': 'No basic wash',
  'أدخل سعر الغسيل الأساسي': 'Enter the basic wash price',
  'أدخل سعر الإضافة المحددة': 'Enter the price for the selected add-on',
  'إضافات الغسيل (اختياري)': 'Wash Add-ons (optional)',
  'سعر ثابت': 'Fixed price',

  'خدمات إضافية (تُدخل يدوياً)': 'Additional Services (manual entry)',
  'يُدخل يدوياً': 'Enter manually',

  'الإجمالي': 'Total',

  'الدفع والتنفيذ': 'Payment & Execution',
  'حالة الدفع': 'Payment Status',
  'نوع البطاقة (لحساب عمولة البنك)': 'Card Type (for bank commission)',
  'نوع البطاقة': 'Card Type',
  'التاريخ': 'Date',
  'الموظف المنفّذ': 'Employee',
  'اختر الموظف': 'Select employee',
  'ملاحظات (اختياري)': 'Notes (optional)',
  'أي ملاحظات إضافية...': 'Any additional notes...',

  'تسجيل العملية': 'Submit Entry',
  'جاري الحفظ...': 'Saving...',
  '✏️ أنت الحين تعدّل عملية سابقة — الحفظ راح يحدّثها بدل ما يسجّل عملية جديدة.': '✏️ You are editing a previous entry — saving will update it instead of creating a new one.',
  'حفظ التعديلات': 'Save Changes',
  'إلغاء التعديل': 'Cancel Edit',
  'الرجاء تعبئة: رقم الجوال، رقم اللوحة، خدمة واحدة على الأقل (غسيل أساسي أو إضافة)، والموظف المنفّذ.':
    'Please fill in: phone number, plate number, at least one service (basic wash or add-on), and the employee.',

  'ملخص اليوم المالي': "Today's Financial Summary",
  'مُحصَّل فعلياً': 'Actually Collected',
  'آجل — غير محصَّل (لحين السداد)': 'Deferred — Uncollected',
  'الإجمالي الكلي (حجم المبيعات)': 'Grand Total (sales volume)',
  '🏦 تسوية مع رسالة البنك (لأي تاريخ)': '🏦 Bank SMS Reconciliation (any date)',
  'المبلغ الفعلي من رسالة البنك': 'Actual amount from bank SMS',
  'احسب واحفظ': 'Calculate & Save',
  'جاري الحساب...': 'Calculating...',
  'إجمالي البطاقة بالنظام:': 'Card total in system:',
  'الوارد فعلياً من البنك:': 'Actually received from bank:',
  'العمولة الفعلية:': 'Actual commission:',
  'النسبة الفعلية:': 'Actual rate:',
  'رقم الجوال (كل سيارات نفس الشخص)': "Phone number (all of this person's cars)",

  'المستحقات / كشف حساب عميل': 'Dues / Customer Statement',
  'رقم اللوحة (سيارة واحدة) أو رقم الجوال (كل سيارات نفس الشخص)': "Plate number (one car) or phone number (all of this person's cars)",
  'لا توجد عمليات مطابقة للبحث': 'No matching entries',
  'لا توجد مستحقات غير مسددة': 'No outstanding dues',
  'عدد العمليات:': 'Entries:',
  'إجمالي كل العمليات:': 'Total of all entries:',
  'منها غير محصَّل:': 'Uncollected:',
  'تحصيل الآن': 'Collect Now',
  'تعديل': 'Edit',
  'حذف': 'Delete',
  '📤 مشاركة الكشف عبر واتساب': '📤 Share Statement via WhatsApp',

  'سجل اليوم': "Today's Log",
  'لا توجد عمليات مسجلة اليوم بعد': 'No entries recorded today yet',

  'متأكد تبغى تحذف هذي العملية؟ لا يمكن التراجع بعد الحذف.': 'Are you sure you want to delete this entry? This cannot be undone.',
  'تعذّر حذف العملية — حدّث الصفحة وحاول مرة أخرى.': 'Could not delete the entry — refresh the page and try again.',
  'تعذّر تحميل بيانات العملية للتعديل.': 'Could not load the entry for editing.',
  'حدث خطأ أثناء الحفظ، حاول مرة أخرى.': 'An error occurred while saving, please try again.',
  'تعذّر حساب التسوية': 'Could not calculate the reconciliation',

  'كلمة المرور': 'Password',
  'دخول': 'Login',
  'كلمة المرور غير صحيحة': 'Incorrect password',

  // /admin/finance
  'الشؤون المالية': 'Finance',
  'مصاريف شهرية ورواتب': 'Monthly expenses & payroll',
  '← الرجوع للإعدادات': '← Back to Settings',
  'كل قيد هنا يُسجَّل مباشرة بدفتر المحاسبة (accounting_transactions). فورم الرواتب يمنع تسجيل نفس العامل مرتين لنفس الشهر تلقائياً.':
    'Every entry here posts directly to the accounting ledger (accounting_transactions). The payroll form automatically prevents posting the same worker twice for the same month.',
  '✓ تم الحفظ': '✓ Saved',

  'مصاريف شهرية': 'Monthly expenses',
  'المبلغ': 'Amount',
  'حفظ المصروف': 'Save expense',
  'تعذّر الحفظ': 'Could not save',

  'رواتب': 'Payroll',
  'ما فيه شهر منتهي بعد — الشهر يظهر هنا بعد ما يخلص كامل (أرقام الرواتب تبقى غير مكتملة قبل ذلك).':
    'No completed month yet — a month appears here once it has fully ended (payroll figures stay incomplete before that).',
  'جاري التحميل...': 'Loading...',
  '✓ مدفوع': '✓ Paid',
  'تعذّر التحميل': 'Could not load',
  'تأكيد وحفظ': 'Confirm & save',

  'تقرير مالي': 'Financial report',
  'تعذّر تحميل التقرير': 'Could not load the report',
  'عرض الفترة المحددة': 'Show selected period',
  'إجمالي الإيرادات': 'Total revenue',
  'إجمالي المصاريف': 'Total expenses',
  'صافي الربح': 'Net profit',
  'ما فيه أي عملية بهذي الفترة.': 'No entries in this period.',
  'تفاصيل عمليات اليوم (اللوحة/الخدمات/المبلغ)': "Day's entries (plate/services/amount)",
  'ما فيه عمليات تسجيل يومي بهذا التاريخ.': 'No daily entries for this date.',
  '⬇️ تحميل Excel (CSV)': '⬇️ Download Excel (CSV)',

  // CSV export headers
  'الفترة': 'Period',
  'رقم الحساب': 'Account code',
  'اسم الحساب': 'Account name',
  'النوع': 'Type',
  'الوقت': 'Time',
  'اللوحة': 'Plate',
  'العميل': 'Customer',
  'الخدمات': 'Services',
  'الموظف': 'Employee',
  'طريقة الدفع': 'Payment method',
  'عوامل مؤثرة بهذي الفترة': 'Demand factors this period',
  'يوم ممطر': 'rainy day(s)',
  'يوم حر شديد': 'extreme-heat day(s)',
  'ما فيه بيانات طقس لهذي الفترة بعد — اضغط "مزامنة الطقس" بشاشة عوامل الطلب.':
    'No weather data for this period yet — run "Sync weather" on the Demand Factors screen.',
  'ما فيه عوامل مؤثرة يدوية بهذي الفترة.': 'No manual events logged for this period.',
};

export function t(text: string, lang: Lang): string {
  if (lang === 'ar') return text;
  return DICT[text] ?? text;
}
