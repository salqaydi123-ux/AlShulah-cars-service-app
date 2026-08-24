import { createClient } from '@supabase/supabase-js';

// عميل Supabase بمفتاح service_role — يعمل فقط على الخادم (Server Actions / Route Handlers)
// ويتجاوز RLS عمداً، لأن الجداول لا تملك أي policy عامة. لا تستورد هذا الملف من أي مكوّن عميل (Client Component).
// لا يوجد لدينا أنواع Database مولّدة من Supabase CLI بعد، فنستخدم `any` كنوع مخطط عام
// بدل ترك النوع الافتراضي يتحوّل إلى `never` بوضع strict — بدون التأثير على سلامة الكود نفسه،
// لأن كل قيمة عائدة من الاستعلامات تُمرَّر يدوياً عبر أنواع src/lib/types.ts.
let cached: ReturnType<typeof createClient<any, any, any>> | null = null;

export function supabaseAdmin() {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'متغيرات البيئة SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY غير مضبوطة. راجع ملف .env.example'
    );
  }

  cached = createClient<any, any, any>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
