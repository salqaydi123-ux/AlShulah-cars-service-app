-- نظام "عوامل مؤثرة على الطلب": جدولان مستقلان عن المخطط المحاسبي، يُستخدمان لاحقاً
-- بتقرير يربط الإيراد اليومي (من accounting_transactions) بالطقس والأحداث الاستثنائية —
-- أساس تحليل "ليش يوم معين قل/زاد فيه الطلب" بالتقرير الشهري/السنوي مستقبلاً.

-- 1) weather_daily: تُعبّى تلقائياً عبر زر "مزامنة الطقس" بصفحة /admin (Visual Crossing API،
--    إحداثيات كلباء) — لا إدخال يدوي هنا.
create table weather_daily (
    date              date primary key,
    precipitation_mm  numeric(6,2) not null default 0,
    is_rainy          boolean not null default false,
    temp_max_c        numeric(5,2),
    is_extreme_heat   boolean not null default false,
    fetched_at        timestamptz not null default now()
);

-- 2) business_factors_log: يدوي بالكامل — أي حدث استثنائي ("إغلاق طريق"، "قبل عيد الفطر"...)
--    يُدخل مرة عبر فورم بسيط بصفحة /admin ويبقى بالسجل لأي تحليل مستقبلي.
create table business_factors_log (
    id          uuid primary key default gen_random_uuid(),
    factor_date date not null,
    note        text not null,
    created_at  timestamptz not null default now()
);

create index idx_business_factors_log_date on business_factors_log(factor_date);

-- نفس مبدأ أمان بقية الجداول: RLS بدون أي policy عامة — الوصول فقط عبر مفتاح service_role
-- من كود الخادم.
alter table weather_daily enable row level security;
alter table business_factors_log enable row level security;
