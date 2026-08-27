export type Lang = 'ar' | 'en';

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
  'إضافات الغسيل (اختياري)': 'Wash Add-ons (optional)',
  'سعر ثابت': 'Fixed price',

  'خدمات إضافية (تُدخل يدوياً)': 'Additional Services (manual entry)',
  'يُدخل يدوياً': 'Enter manually',

  'الإجمالي': 'Total',

  'الدفع والتنفيذ': 'Payment & Execution',
  'حالة الدفع': 'Payment Status',
  'نوع البطاقة (لحساب عمولة البنك)': 'Card Type (for bank commission)',
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
  'مُحصَّل فعلياً (صافي بعد عمولة البنك)': 'Actually Collected (net after bank fee)',
  'عمولات البنك المقتطعة اليوم': "Today's Bank Commissions",
  'آجل — غير محصَّل (لحين السداد)': 'Deferred — Uncollected',
  'الإجمالي الكلي (حجم المبيعات — قبل خصم العمولة)': 'Grand Total (sales volume — before commission)',
  '🏦 تسوية مع رسالة البنك (اختياري — يومياً)': '🏦 Bank SMS Reconciliation (optional — daily)',
  'المبلغ الوارد من رسالة البنك اليوم': "Amount from today's bank SMS",
  'احسب': 'Calculate',
  'إجمالي البطاقة بالنظام:': 'Card total in system:',
  'الوارد فعلياً من البنك:': 'Actually received from bank:',
  'العمولة الفعلية اليوم:': "Today's actual commission:",
  'النسبة الفعلية:': 'Actual rate:',
  'سجّل هذي النسبة كم يوم متتالي — لو تكررت، حدّثها بالإعدادات لضبط النظام بدقة بدل الانتظار.':
    'Track this rate for a few consecutive days — if it repeats, update it in Settings to fine-tune the system instead of waiting.',

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
};

export function t(text: string, lang: Lang): string {
  if (lang === 'ar') return text;
  return DICT[text] ?? text;
}
