// قوائم ثابتة (واقع جغرافي/إداري لدولة الإمارات) — ليست "إعدادات تسعير" وبالتالي غير مُخزَّنة كـ config قابل للتعديل.
export const EMIRATES = [
  'الشارقة',
  'دبي',
  'أبوظبي',
  'عجمان',
  'أم القيوين',
  'رأس الخيمة',
  'الفجيرة',
] as const;

export const BODY_LABEL: Record<string, string> = {
  sedan: 'صالون',
  fourwd: 'فورويل / SUV / بيك أب',
};

export const CARD_LABEL: Record<string, string> = {
  debit: 'مدى/خصم مباشر',
  credit: 'فيزا/ماستركارد',
  amex: 'أمريكان إكسبريس',
};

export const PAY_STATUS_LABEL: Record<string, string> = {
  paid: 'مسدد',
  pending: 'آجل — غير مسدد',
};
