-- ============================================================
-- نظام الشعلة لخدمة السيارات — النظام المالي والمحاسبي
-- Supabase / PostgreSQL Schema
-- يُضاف إلى نفس قاعدة بيانات نظام التسجيل اليومي
--
-- مستقل تماماً عن جداول 0001_init.sql (addon_services وغيرها) —
-- جداول وviews وtriggers جديدة بالكامل لنظام محاسبي منفصل.
--
-- تعديل واحد عن الملف الأصلي المرفوع: جدول دفتر اليومية العام تمت
-- تسميته accounting_transactions بدل transactions، لأن اسم transactions
-- محجوز مسبقاً بجدول عمليات التطبيق اليومي (customers/vehicles) في
-- 0001_init.sql — نفس الاسم كان سيصطدم بـ "relation already exists"
-- عند التنفيذ. كل الإشارات الداخلية (indexes، inserts، الـ views،
-- الـ trigger) عُدّلت بالتوافق.
-- ============================================================

-- ------------------------------------------------------------
-- 0) الكيانات (Entities) — تحضير لتعدد المشاريع ضمن المنظومة الأكبر
--    الآن: كيان واحد فقط (الشعلة). لاحقاً: العقار المؤجر ككيان مستقل.
--    لا يُبنى منطق العقار الآن — فقط البنية تتحمّله.
-- ------------------------------------------------------------
create table entities (
    entity_id     uuid primary key default gen_random_uuid(),
    entity_name   text not null,
    entity_type   text not null default 'business',  -- 'business' | 'real_estate' ...
    is_active     boolean default true,
    created_at    timestamptz default now()
);

insert into entities (entity_name, entity_type) values
('Al Shulah Cars Service','business');
-- لاحقاً: insert into entities (entity_name, entity_type) values ('العقار المؤجر','real_estate');


-- ------------------------------------------------------------
-- 1) شجرة الحسابات (Chart of Accounts)
-- ------------------------------------------------------------
create table chart_of_accounts (
    account_code    varchar(5) primary key,
    entity_id       uuid not null references entities(entity_id),
    account_name_ar text not null,
    account_name_en text,
    account_type    text not null check (account_type in
                     ('asset','liability','equity','revenue','expense')),
    parent_code     varchar(5) references chart_of_accounts(account_code),
    is_accrual      boolean default false,   -- true لحسابات المخصصات (60200، 60300)
    is_active       boolean default true,
    created_at      timestamptz default now()
);

insert into chart_of_accounts (account_code, entity_id, account_name_ar, account_name_en, account_type, is_accrual)
select code, (select entity_id from entities where entity_name = 'Al Shulah Cars Service'),
       name_ar, name_en, acc_type, accrual
from (values
-- الأصول
('10100','الصندوق النقدي','Cash','asset',false),
('10200','حساب ADIB البنكي','Bank Account','asset',false),
('10300','مستحقات POS','POS Receivables','asset',false),
('10400','مخزون المواد','Inventory','asset',false),
('10500','معدات المغسلة','Equipment','asset',false),
('10600','سيارة المغسلة','Company Vehicle','asset',false),
-- الالتزامات
('20100','ذمم دائنة – موردين','Accounts Payable','liability',false),
('20200','مستحقات رواتب غير مدفوعة','Accrued Salaries','liability',false),
('20300','مخصص تذاكر العمال','Accrued Worker Tickets','liability',true),
('20400','مخصص تجديد التأشيرات','Accrued Visa Renewals','liability',true),
('20500','مخصص ضريبة القيمة المضافة','Accrued VAT','liability',false),
-- حقوق الملكية
('30100','رأس المال / سحوبات المالك','Owner Equity/Drawings','equity',false),
('30200','أرباح مرحّلة','Retained Earnings','equity',false),
-- الإيرادات
('40100','إيرادات غسيل عادي','Wash Revenue','revenue',false),
('40200','إيرادات تلميع/تفصيل','Detailing Revenue','revenue',false),
('40300','إيرادات خدمات إضافية','Other Service Revenue','revenue',false),
-- المصاريف الثابتة
('50100','إيجار','Rent','expense',false),
('50200','كهرباء وماء','Electricity Bill','expense',false),
('50300','اتصالات وإنترنت','Internet Bill','expense',false),
('50350','رسوم بنكية','Bank Charges','expense',false),
('50400','صيانة','Maintenance','expense',false),
('50500','تجديد الرخصة التجارية','Trade License Renewal','expense',false),
('50600','تجديد/تأمين سيارة المغسلة','Company Vehicle Renewal','expense',false),
-- مصاريف العمالة
('60100','رواتب العمال','Worker Salaries','expense',false),
('60200','تكلفة تذاكر مستحقة شهرياً','Accrued Ticket Expense','expense',true),
('60300','تكلفة تأشيرات مستحقة شهرياً','Accrued Visa Expense','expense',true),
-- المصاريف المتغيرة
('70100','مشتريات مواد التنظيف','Cleaning Supplies Purchases','expense',false)
) as t(code, name_ar, name_en, acc_type, accrual);


-- ------------------------------------------------------------
-- 2) جدول العمال (Workers) — لحساب المخصصات تلقائياً
-- ------------------------------------------------------------
create table workers (
    worker_id           uuid primary key default gen_random_uuid(),
    entity_id           uuid not null references entities(entity_id),  -- يُمرَّر صراحة عند الإدخال (Postgres لا يسمح بـ subquery في DEFAULT)
    employee_code       text,                    -- كود داخلي للتصنيف (SH-001...) — وليس من سجلات رسمية
    full_name           text not null,
    job_title_official  text,                    -- المسمى الرسمي (سجلات العمل والهجرة)
    job_title_internal  text,                    -- المسمى الفعلي حسب التخصص/الخبرة (يُستكمل لاحقاً)
    nationality         text,                    -- India | Bangladesh
    passport_number     text,
    hire_date           date,                    -- يُستكمل لاحقاً حسب بيانات كل عامل
    last_return_date    date,                    -- تاريخ العودة من آخر إجازة
    basic_salary        numeric(10,2),           -- الراتب الأساسي (لأصحاب الراتب الثابت)
    allowance           numeric(10,2),            -- البدل (سكن/مواصلات..) من كشف الرواتب
    gross_salary        numeric(10,2) generated always as
                         (coalesce(basic_salary,0) + coalesce(allowance,0)) stored,

    -- نوع نظام الأجر:
    --   'fixed'                 : راتب ثابت (basic_salary + allowance)
    --   'revenue_share'         : نسبة من إجمالي الدخل الشهري (مثال: زكريا 5%)
    --   'fixed_plus_profit_share': ثابت + نسبة من صافي الربح (مثال: محمد علي 4000 + 20%)
    compensation_type   text not null default 'fixed'
                         check (compensation_type in ('fixed','revenue_share','fixed_plus_profit_share')),
    variable_pct         numeric(5,2),             -- النسبة المئوية (5.00 = 5%)
    variable_base        text
                         check (variable_base in ('gross_revenue','net_profit')),
    declared_wps_salary  numeric(10,2),           -- الراتب الأساسي المصرّح بعقد العمل/WPS (لأغراض قانونية، قد يختلف عن الأجر الفعلي)

    sponsorship_type    text not null default 'company'
                         check (sponsorship_type in ('company','personal')),  -- 'personal' = على كفالة شخصية (مثل عمران)
    is_active           boolean default true,

    -- بيانات التأشيرة
    visa_issue_date     date,
    visa_expiry_date    date,                    -- التاريخ الفعلي من الوثيقة (لا يُحسب تلقائياً — المدة الفعلية قد تختلف عن سنتين بالضبط)
    visa_last_cost      numeric(10,2),           -- آخر تكلفة تجديد فعلية

    -- بيانات التذكرة السنوية
    ticket_due_date     date generated always as
                         ((last_return_date + interval '1 year')::date) stored,  -- سنة من تاريخ العودة (يُدفع عند السفر التالي)
    ticket_cost         numeric(10,2) default 500,

    created_at          timestamptz default now(),
    updated_at          timestamptz default now()
);


-- بيانات العمال الفعليين — الأرقام المعتمدة (كشف الأساسي+البدل هو المرجع عند التعارض)
-- (تواريخ التأشيرة/التوظيف تُستكمل لاحقاً)
insert into workers (entity_id, full_name, job_title_official, basic_salary, allowance, compensation_type, sponsorship_type)
select (select entity_id from entities where entity_name = 'Al Shulah Cars Service'),
       name, job, basic, allow, comp_type, sponsor
from (values
('ABDUL SALIK ABDUL MANNAN','Stall and Market Salesperson',800,700,'fixed','company'),
('SHAREF AKBAR AKBAR','Vehicle Cleaner',800,800,'fixed','company'),
('SABI RAKAMATHTHULLA RAKAMATHTHULLA','Upholsterer Assistant',800,1200,'fixed','company'),
('ABDUL RAHOOF KUZHIYENGAL','Vehicle Cleaner',500,1500,'fixed','company'),
('SALEEKKALI PULIKKAL MUHAMMED ALI','Vehicle Cleaner',800,1200,'fixed','company'),
('HALAL AHMED SOFOR ALI','Vehicle Cleaner',600,700,'fixed','company'),
('MD MASUK MIAH MD ABDULLHA MIAH','Vehicle Cleaner',800,500,'fixed','company'),
('MOHAMMED IQBAL HOSEN MUNSHI MEAH','Vehicle Cleaner',600,700,'fixed','company'),
('IMRAN','Vehicle Cleaner',500,1000,'fixed','personal')  -- أساسي 500 + بدل 1000 = إجمالي 1500
) as t(name, job, basic, allow, comp_type, sponsor);

-- عمران: أساسي 500 + بدل 1000 = إجمالي 1500 (مكتمل)

-- زكريا: عمولة 5% من إجمالي الدخل الشهري (بدون راتب ثابت)
insert into workers (entity_id, full_name, job_title_official, compensation_type, variable_pct, variable_base, sponsorship_type)
values (
    (select entity_id from entities where entity_name = 'Al Shulah Cars Service'),
    'SAKKARIYA AKARIYL SAIDALAVI','Stall and Market Salesperson',
    'revenue_share', 5.00, 'gross_revenue', 'company'
);

-- محمد علي: 4000 ثابت + 20% من صافي الربح الشهري
insert into workers (entity_id, full_name, job_title_official, basic_salary, compensation_type, variable_pct, variable_base, sponsorship_type)
values (
    (select entity_id from entities where entity_name = 'Al Shulah Cars Service'),
    'MUHAMMED ALI PULIKKAL USMAN PULIKKAL','Vehicle Cleaner',
    4000, 'fixed_plus_profit_share', 20.00, 'net_profit', 'company'
);


-- ------------------------------------------------------------
-- 2ب) إجازات العمال — الراتب يتوقف كاملاً أثناء السفر/الإجازة
-- ------------------------------------------------------------
create table worker_leaves (
    leave_id        uuid primary key default gen_random_uuid(),
    worker_id       uuid not null references workers(worker_id),
    leave_start     date not null,
    leave_end       date,              -- فارغ = لسا بالإجازة
    leave_type      text default 'annual',  -- 'annual' | 'unpaid' | 'sick' ...
    created_at      timestamptz default now()
);

-- بيانات آخر إجازة لكل عامل (من كشف الخروج/العودة)
insert into worker_leaves (worker_id, leave_start, leave_end)
select w.worker_id, v.leave_start, v.leave_end
from (values
('SHAREF AKBAR AKBAR','2023-09-15'::date,'2023-12-12'::date),
('ABDUL SALIK ABDUL MANNAN','2024-07-05','2024-10-05'),
('MD MASUK MIAH MD ABDULLHA MIAH','2024-11-30','2025-04-14'),
('MOHAMMED IQBAL HOSEN MUNSHI MEAH','2025-02-22','2025-06-22'),
('IMRAN','2025-04-04','2025-08-07'),
('HALAL AHMED SOFOR ALI','2025-09-11','2026-01-27'),
('ABDUL RAHOOF KUZHIYENGAL','2025-11-13','2026-02-20'),
('SABI RAKAMATHTHULLA RAKAMATHTHULLA','2026-04-04','2026-08-05'),
('SAKKARIYA AKARIYL SAIDALAVI','2026-05-06','2026-06-26'),
('SALEEKKALI PULIKKAL MUHAMMED ALI','2026-02-03','2026-06-30'),
('MUHAMMED ALI PULIKKAL USMAN PULIKKAL','2026-06-02',null)  -- لسا بالإجازة حالياً، بدون تاريخ عودة
) as v(name, leave_start, leave_end)
join workers w on w.full_name = v.name;

-- تحديث تاريخ آخر عودة بجدول العمال (لمن رجع فعلاً)
update workers w set last_return_date = v.leave_end
from (values
('SHAREF AKBAR AKBAR','2023-12-12'::date),
('ABDUL SALIK ABDUL MANNAN','2024-10-05'),
('MD MASUK MIAH MD ABDULLHA MIAH','2025-04-14'),
('MOHAMMED IQBAL HOSEN MUNSHI MEAH','2025-06-22'),
('IMRAN','2025-08-07'),
('HALAL AHMED SOFOR ALI','2026-01-27'),
('ABDUL RAHOOF KUZHIYENGAL','2026-02-20'),
('SABI RAKAMATHTHULLA RAKAMATHTHULLA','2026-08-05'),
('SAKKARIYA AKARIYL SAIDALAVI','2026-06-26'),
('SALEEKKALI PULIKKAL MUHAMMED ALI','2026-06-30')
) as v(name, leave_end)
where w.full_name = v.name;
-- محمد علي: لا تحديث — لسا بالإجازة، last_return_date يبقى فاضي لحد رجوعه

-- view: صافي أيام الحضور والراتب المستحق للشهر الحالي (أو أي شهر) لكل عامل
create or replace view worker_salary_due as
select
    w.worker_id,
    w.full_name,
    date_trunc('month', current_date) as salary_month,
    extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day')) as days_in_month,
    extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day'))
        - coalesce(sum(
            least(coalesce(wl.leave_end, current_date), (date_trunc('month', current_date) + interval '1 month - 1 day')::date)
            - greatest(wl.leave_start, date_trunc('month', current_date)::date)
            + 1
          ) filter (where wl.leave_start <= (date_trunc('month', current_date) + interval '1 month - 1 day')::date
                      and coalesce(wl.leave_end, current_date) >= date_trunc('month', current_date)::date), 0)
        as days_present,
    w.basic_salary
from workers w
left join worker_leaves wl on wl.worker_id = w.worker_id
where w.is_active = true
group by w.worker_id, w.full_name, w.basic_salary;


-- تحديث تواريخ التأشيرة الفعلية (من كشف التأشيرات)
update workers set visa_issue_date = '2026-07-24', visa_expiry_date = '2028-07-06'
    where full_name = 'MD MASUK MIAH MD ABDULLHA MIAH';
update workers set visa_issue_date = '2026-07-10', visa_expiry_date = '2028-07-04'
    where full_name = 'HALAL AHMED SOFOR ALI';
update workers set visa_issue_date = '2026-08-03', visa_expiry_date = '2028-07-04'
    where full_name = 'MOHAMMED IQBAL HOSEN MUNSHI MEAH';
update workers set visa_issue_date = '2025-09-18', visa_expiry_date = '2027-09-17'
    where full_name = 'ABDUL SALIK ABDUL MANNAN';
update workers set visa_issue_date = '2024-11-02', visa_expiry_date = '2026-10-06'
    where full_name = 'IMRAN';
update workers set visa_issue_date = '2026-03-04', visa_expiry_date = '2028-03-03'
    where full_name = 'ABDUL RAHOOF KUZHIYENGAL';
update workers set visa_issue_date = '2024-11-02', visa_expiry_date = '2026-10-05'
    where full_name = 'SHAREF AKBAR AKBAR';
update workers set visa_issue_date = '2024-08-07', visa_expiry_date = '2026-08-07'
    where full_name = 'SABI RAKAMATHTHULLA RAKAMATHTHULLA';
update workers set visa_issue_date = '2025-07-18', visa_expiry_date = '2027-07-17'
    where full_name = 'SALEEKKALI PULIKKAL MUHAMMED ALI';
update workers set visa_issue_date = '2025-05-10', visa_expiry_date = '2027-05-02'
    where full_name = 'SAKKARIYA AKARIYL SAIDALAVI';
update workers set visa_issue_date = '2025-09-17', visa_expiry_date = '2027-09-16'
    where full_name = 'MUHAMMED ALI PULIKKAL USMAN PULIKKAL';


-- تحديث الجنسية ورقم الجواز (من كشف Passport Detail)
update workers set nationality = 'Bangladesh', passport_number = 'W0657249'
    where full_name = 'ABDUL SALIK ABDUL MANNAN';
update workers set nationality = 'India', passport_number = 'R9587145'
    where full_name = 'MUHAMMED ALI PULIKKAL USMAN PULIKKAL';
update workers set nationality = 'India', passport_number = 'N0955462'
    where full_name = 'ABDUL RAHOOF KUZHIYENGAL';
update workers set nationality = 'Bangladesh', passport_number = 'A01121525'
    where full_name = 'MOHAMMED IQBAL HOSEN MUNSHI MEAH';
update workers set nationality = 'Bangladesh', passport_number = 'A02404885'
    where full_name = 'HALAL AHMED SOFOR ALI';
update workers set nationality = 'Bangladesh', passport_number = 'A01858142'
    where full_name = 'MD MASUK MIAH MD ABDULLHA MIAH';
update workers set nationality = 'India', passport_number = 'L8517778'
    where full_name = 'SABI RAKAMATHTHULLA RAKAMATHTHULLA';
update workers set nationality = 'India', passport_number = 'R1756389'
    where full_name = 'SHAREF AKBAR AKBAR';
update workers set nationality = 'India', passport_number = 'E1780085'
    where full_name = 'SAKKARIYA AKARIYL SAIDALAVI';
update workers set nationality = 'India', passport_number = 'V9292613'
    where full_name = 'SALEEKKALI PULIKKAL MUHAMMED ALI';
-- IMRAN: غير موجود بكشف الجوازات — الجنسية بنجلاديش (بدون رقم جواز حالياً)
update workers set nationality = 'Bangladesh', passport_number = 'EG0613319' where full_name = 'IMRAN';


-- أكواد الموظفين الداخلية (SH-001...) للتصنيف والمرجعية
update workers set employee_code = 'SH-001' where full_name = 'ABDUL SALIK ABDUL MANNAN';
update workers set employee_code = 'SH-002' where full_name = 'MUHAMMED ALI PULIKKAL USMAN PULIKKAL';
update workers set employee_code = 'SH-003' where full_name = 'ABDUL RAHOOF KUZHIYENGAL';
update workers set employee_code = 'SH-004' where full_name = 'MOHAMMED IQBAL HOSEN MUNSHI MEAH';
update workers set employee_code = 'SH-005' where full_name = 'HALAL AHMED SOFOR ALI';
update workers set employee_code = 'SH-006' where full_name = 'MD MASUK MIAH MD ABDULLHA MIAH';
update workers set employee_code = 'SH-007' where full_name = 'SABI RAKAMATHTHULLA RAKAMATHTHULLA';
update workers set employee_code = 'SH-008' where full_name = 'SHAREF AKBAR AKBAR';
update workers set employee_code = 'SH-009' where full_name = 'SAKKARIYA AKARIYL SAIDALAVI';
update workers set declared_wps_salary = 500 where full_name = 'SAKKARIYA AKARIYL SAIDALAVI';
update workers set employee_code = 'SH-010' where full_name = 'SALEEKKALI PULIKKAL MUHAMMED ALI';
update workers set employee_code = 'SH-011' where full_name = 'IMRAN';


-- زكريا ومحمد علي: غير مستحقين قيمة التذكرة السنوية (استثناء بشروط عقدهما)
update workers set ticket_cost = 0 where full_name in
    ('SAKKARIYA AKARIYL SAIDALAVI','MUHAMMED ALI PULIKKAL USMAN PULIKKAL');

-- تكلفة تجديد التأشيرة لكل السنتين — الرقم الفعلي
-- عمران (كفالة شخصية) تكلفته مختلفة تماماً
update workers set visa_last_cost = 5250
    where sponsorship_type = 'company';
update workers set visa_last_cost = 1500
    where full_name = 'IMRAN';


-- ------------------------------------------------------------
-- 3) دفتر اليومية العام (Journal / Transactions)
--    كل عملية مالية (إيراد أو مصروف) تُسجَّل هنا بقيد واحد مبسّط
--    (single-entry مربوط بحساب من شجرة الحسابات — عملي وكافي لحجم النشاط)
-- ------------------------------------------------------------
create table accounting_transactions (
    transaction_id   uuid primary key default gen_random_uuid(),
    transaction_date date not null default current_date,
    account_code     varchar(5) not null references chart_of_accounts(account_code),
    amount           numeric(12,2) not null,       -- موجب = دخول، سالب = خروج (أو استخدم direction)
    direction        text not null check (direction in ('debit','credit')),
    description      text,
    source           text default 'manual',        -- 'daily_app' | 'manual' | 'accrual_engine'
    reference_id     uuid,                          -- يربط بجدول التسجيل اليومي عند وجوده
    worker_id         uuid references workers(worker_id),
    created_at       timestamptz default now()
);

create index idx_accounting_transactions_date on accounting_transactions(transaction_date);
create index idx_accounting_transactions_account on accounting_transactions(account_code);


-- أول قيود فعلية حقيقية: تحويل رواتب يوليو 2026 عبر الأنصاري للصرافة (فاتورة WPS رقم 100190150)
insert into accounting_transactions (transaction_date, account_code, amount, direction, description, source) values
('2026-07-31','60100',5400.00,'debit','رواتب أساسية يوليو 2026 — WPS الأنصاري: 7 عمال ثابتين (سابي بإجازة) + زكريا (راتب مصرّح 500)، عدا عمران ومحمد علي','manual'),
('2026-07-31','50350',68.25,'debit','رسوم تحويل رواتب + ضريبة (Al Ansari Exchange) — فاتورة 100190150','manual');


-- ============================================================
-- بيانات 2025 التاريخية (أبريل - ديسمبر) — من الدفتر اليدوي
-- ملاحظة: Trade License أغسطس = 12,342 (مؤكد من المستخدم)
-- ============================================================

-- الإيرادات الشهرية (40100)
insert into accounting_transactions (transaction_date, account_code, amount, direction, description, source) values
('2025-04-30','40100',47705,'credit','إجمالي إيرادات أبريل 2025 — دفتر يدوي','manual'),
('2025-05-31','40100',47400,'credit','إجمالي إيرادات مايو 2025 — دفتر يدوي','manual'),
('2025-06-30','40100',45419,'credit','إجمالي إيرادات يونيو 2025 — دفتر يدوي','manual'),
('2025-07-31','40100',48055,'credit','إجمالي إيرادات يوليو 2025 — دفتر يدوي','manual'),
('2025-08-31','40100',51150,'credit','إجمالي إيرادات أغسطس 2025 — دفتر يدوي','manual'),
('2025-09-30','40100',41496,'credit','إجمالي إيرادات سبتمبر 2025 — دفتر يدوي','manual'),
('2025-10-31','40100',45078,'credit','إجمالي إيرادات أكتوبر 2025 — دفتر يدوي','manual'),
('2025-11-30','40100',39980,'credit','إجمالي إيرادات نوفمبر 2025 — دفتر يدوي','manual'),
('2025-12-31','40100',46241,'credit','إجمالي إيرادات ديسمبر 2025 — دفتر يدوي','manual');

-- الرواتب الشهرية الإجمالية (60100)
insert into accounting_transactions (transaction_date, account_code, amount, direction, description, source) values
('2025-04-30','60100',14974,'debit','إجمالي رواتب أبريل 2025 — دفتر يدوي','manual'),
('2025-05-31','60100',14765,'debit','إجمالي رواتب مايو 2025 — دفتر يدوي','manual'),
('2025-06-30','60100',12073,'debit','إجمالي رواتب يونيو 2025 — دفتر يدوي','manual'),
('2025-07-31','60100',15073,'debit','إجمالي رواتب يوليو 2025 — دفتر يدوي','manual'),
('2025-08-31','60100',17273,'debit','إجمالي رواتب أغسطس 2025 — دفتر يدوي','manual'),
('2025-09-30','60100',16272,'debit','إجمالي رواتب سبتمبر 2025 — دفتر يدوي','manual'),
('2025-10-31','60100',16268,'debit','إجمالي رواتب أكتوبر 2025 — دفتر يدوي','manual'),
('2025-11-30','60100',13763,'debit','إجمالي رواتب نوفمبر 2025 — دفتر يدوي','manual'),
('2025-12-31','60100',14263,'debit','إجمالي رواتب ديسمبر 2025 — دفتر يدوي','manual');

-- المصاريف المتغيرة/المشتريات الشهرية (70100)
insert into accounting_transactions (transaction_date, account_code, amount, direction, description, source) values
('2025-04-30','70100',7630,'debit','مصاريف متغيرة أبريل 2025 — دفتر يدوي','manual'),
('2025-05-31','70100',6057,'debit','مصاريف متغيرة مايو 2025 — دفتر يدوي','manual'),
('2025-06-30','70100',9076,'debit','مصاريف متغيرة يونيو 2025 — دفتر يدوي','manual'),
('2025-07-31','70100',6144,'debit','مصاريف متغيرة يوليو 2025 — دفتر يدوي','manual'),
('2025-08-31','70100',7224,'debit','مصاريف متغيرة أغسطس 2025 — دفتر يدوي','manual'),
('2025-09-30','70100',5510,'debit','مصاريف متغيرة سبتمبر 2025 — دفتر يدوي','manual'),
('2025-10-31','70100',6810,'debit','مصاريف متغيرة أكتوبر 2025 — دفتر يدوي','manual'),
('2025-11-30','70100',7491,'debit','مصاريف متغيرة نوفمبر 2025 — دفتر يدوي','manual'),
('2025-12-31','70100',8477,'debit','مصاريف متغيرة ديسمبر 2025 — دفتر يدوي','manual');

-- التكاليف الثابتة الشهرية المفصّلة (من كشف الإيجار/الفواتير/التأشيرات 2025)
insert into accounting_transactions (transaction_date, account_code, amount, direction, description, source) values
-- أبريل
('2025-04-30','50100',7125,'debit','إيجار أبريل 2025','manual'),
('2025-04-30','50200',3054,'debit','كهرباء أبريل 2025','manual'),
('2025-04-30','50300',377,'debit','إنترنت أبريل 2025','manual'),
('2025-04-30','50350',132,'debit','رسوم بنكية أبريل 2025','manual'),
('2025-04-30','60200',850,'debit','تذاكر عمال أبريل 2025','manual'),
('2025-04-30','50400',1600,'debit','صيانة أبريل 2025','manual'),
-- مايو
('2025-05-31','50100',7125,'debit','إيجار مايو 2025','manual'),
('2025-05-31','50200',4066,'debit','كهرباء مايو 2025','manual'),
('2025-05-31','50300',377,'debit','إنترنت مايو 2025','manual'),
('2025-05-31','50350',132,'debit','رسوم بنكية مايو 2025','manual'),
('2025-05-31','60300',5465,'debit','تجديد تأشيرة مايو 2025','manual'),
-- يونيو
('2025-06-30','50100',7125,'debit','إيجار يونيو 2025','manual'),
('2025-06-30','50200',4559,'debit','كهرباء يونيو 2025','manual'),
('2025-06-30','50300',377,'debit','إنترنت يونيو 2025','manual'),
('2025-06-30','50350',132,'debit','رسوم بنكية يونيو 2025','manual'),
('2025-06-30','50400',248,'debit','صيانة يونيو 2025','manual'),
-- يوليو
('2025-07-31','50100',7125,'debit','إيجار يوليو 2025','manual'),
('2025-07-31','50200',5041,'debit','كهرباء يوليو 2025','manual'),
('2025-07-31','50300',377,'debit','إنترنت يوليو 2025','manual'),
('2025-07-31','50350',132,'debit','رسوم بنكية يوليو 2025','manual'),
('2025-07-31','60300',6750,'debit','تجديد تأشيرة يوليو 2025','manual'),
('2025-07-31','50500',5045,'debit','تجديد رخصة تجارية يوليو 2025','manual'),
('2025-07-31','50600',3010,'debit','تجديد سيارة المغسلة يوليو 2025','manual'),
-- أغسطس
('2025-08-31','50100',7125,'debit','إيجار أغسطس 2025','manual'),
('2025-08-31','50200',5258,'debit','كهرباء أغسطس 2025','manual'),
('2025-08-31','50300',377,'debit','إنترنت أغسطس 2025','manual'),
('2025-08-31','50350',132,'debit','رسوم بنكية أغسطس 2025','manual'),
('2025-08-31','50500',12342,'debit','تجديد رخصة تجارية أغسطس 2025','manual'),
('2025-08-31','50400',856,'debit','صيانة أغسطس 2025','manual'),
('2025-08-31','50600',550,'debit','تجديد سيارة المغسلة أغسطس 2025','manual'),
-- سبتمبر
('2025-09-30','50100',7125,'debit','إيجار سبتمبر 2025','manual'),
('2025-09-30','50200',5337,'debit','كهرباء سبتمبر 2025','manual'),
('2025-09-30','50300',377,'debit','إنترنت سبتمبر 2025','manual'),
('2025-09-30','50350',132,'debit','رسوم بنكية سبتمبر 2025','manual'),
('2025-09-30','60300',11185,'debit','تجديد تأشيرة سبتمبر 2025','manual'),
('2025-09-30','60200',1610,'debit','تذاكر عمال سبتمبر 2025','manual'),
-- أكتوبر
('2025-10-31','50100',7125,'debit','إيجار أكتوبر 2025','manual'),
('2025-10-31','50200',3919,'debit','كهرباء أكتوبر 2025','manual'),
('2025-10-31','50300',377,'debit','إنترنت أكتوبر 2025','manual'),
('2025-10-31','50350',132,'debit','رسوم بنكية أكتوبر 2025','manual'),
('2025-10-31','50400',5134,'debit','صيانة أكتوبر 2025','manual'),
-- نوفمبر
('2025-11-30','50100',7125,'debit','إيجار نوفمبر 2025','manual'),
('2025-11-30','50200',3449,'debit','كهرباء نوفمبر 2025','manual'),
('2025-11-30','50300',377,'debit','إنترنت نوفمبر 2025','manual'),
('2025-11-30','50350',132,'debit','رسوم بنكية نوفمبر 2025','manual'),
('2025-11-30','60200',500,'debit','تذاكر عمال نوفمبر 2025','manual'),
-- ديسمبر
('2025-12-31','50100',7125,'debit','إيجار ديسمبر 2025','manual'),
('2025-12-31','50200',2371,'debit','كهرباء ديسمبر 2025','manual'),
('2025-12-31','50300',377,'debit','إنترنت ديسمبر 2025','manual'),
('2025-12-31','50350',132,'debit','رسوم بنكية ديسمبر 2025','manual'),
('2025-12-31','50400',1860,'debit','صيانة ديسمبر 2025','manual');

-- مكافأة محمد علي الشهرية (20% من صافي الربح) — مربوطة بملفه الشخصي
insert into accounting_transactions (transaction_date, account_code, amount, direction, description, source, worker_id)
select d.month_date, '60100', d.amt, 'debit', 'مكافأة محمد علي (20% من الربح) — '||d.month_label, 'manual',
       (select worker_id from workers where full_name = 'MUHAMMED ALI PULIKKAL USMAN PULIKKAL')
from (values
    ('2025-04-30'::date, 1420, 'أبريل 2025'),
    ('2025-05-31'::date, 1715, 'مايو 2025'),
    ('2025-06-30'::date, 1254, 'يونيو 2025'),
    ('2025-07-31'::date, 1768, 'يوليو 2025'),
    ('2025-08-31'::date, 1730, 'أغسطس 2025'),
    ('2025-09-30'::date, 343,  'سبتمبر 2025'),
    ('2025-10-31'::date, 800,  'أكتوبر 2025'),
    ('2025-11-30'::date, 152,  'نوفمبر 2025'),
    ('2025-12-31'::date, 1100, 'ديسمبر 2025')
) as d(month_date, amt, month_label);


-- ============================================================
-- بيانات 2026 الفعلية (يناير - يوليو) — من الدفتر اليدوي
-- ملاحظة: "Extra 18000" بالدفتر كان رقم تقديري (ميزانية) — التكاليف
-- الثابتة الفعلية المفصّلة أُدخلت لاحقاً بأسفل (بعد المصاريف المتغيرة)
-- بعد تحقق رياضي كامل مع الإجمالي الشهري.
-- ============================================================

-- الإيرادات (40100)
insert into accounting_transactions (transaction_date, account_code, amount, direction, description, source) values
('2026-01-31','40100',40542,'credit','إجمالي إيرادات يناير 2026 — دفتر يدوي','manual'),
('2026-02-28','40100',39336,'credit','إجمالي إيرادات فبراير 2026 — دفتر يدوي','manual'),
('2026-03-31','40100',37496,'credit','إجمالي إيرادات مارس 2026 — دفتر يدوي','manual'),
('2026-04-30','40100',59561,'credit','إجمالي إيرادات أبريل 2026 — دفتر يدوي','manual'),
('2026-05-31','40100',38482,'credit','إجمالي إيرادات مايو 2026 — دفتر يدوي','manual'),
('2026-06-30','40100',29502,'credit','إجمالي إيرادات يونيو 2026 — دفتر يدوي','manual'),
('2026-07-31','40100',38661,'credit','إجمالي إيرادات يوليو 2026 — دفتر يدوي','manual');

-- الرواتب (60100) — الرقم الإجمالي من الدفتر (منفصل عن قيد WPS يوليو التفصيلي أعلاه لو تكرر، راجعه لاحقاً لتفادي ازدواج يوليو)
insert into accounting_transactions (transaction_date, account_code, amount, direction, description, source) values
('2026-01-31','60100',14393,'debit','إجمالي رواتب يناير 2026 — دفتر يدوي','manual'),
('2026-02-28','60100',14165,'debit','إجمالي رواتب فبراير 2026 — دفتر يدوي','manual'),
('2026-03-31','60100',15663,'debit','إجمالي رواتب مارس 2026 — دفتر يدوي','manual'),
('2026-04-30','60100',13663,'debit','إجمالي رواتب أبريل 2026 — دفتر يدوي','manual'),
('2026-05-31','60100',13563,'debit','إجمالي رواتب مايو 2026 — دفتر يدوي','manual'),
('2026-06-30','60100',13968,'debit','إجمالي رواتب يونيو 2026 — دفتر يدوي','manual');
-- يوليو 2026: 5,400 محوّلة WPS (مسجلة مسبقاً بالتفصيل) + الباقي كاش
insert into accounting_transactions (transaction_date, account_code, amount, direction, description, source) values
('2026-07-31','60100',10669,'debit','باقي رواتب يوليو 2026 نقداً (إجمالي الشهر 16,069 - 5,400 WPS)','manual');

-- المصاريف المتغيرة (70100)
insert into accounting_transactions (transaction_date, account_code, amount, direction, description, source) values
('2026-01-31','70100',5947,'debit','مصاريف متغيرة يناير 2026 — دفتر يدوي','manual'),
('2026-02-28','70100',6726,'debit','مصاريف متغيرة فبراير 2026 — دفتر يدوي','manual'),
('2026-03-31','70100',4283,'debit','مصاريف متغيرة مارس 2026 — دفتر يدوي','manual'),
('2026-04-30','70100',13313,'debit','مصاريف متغيرة أبريل 2026 — دفتر يدوي','manual'),
('2026-05-31','70100',5997,'debit','مصاريف متغيرة مايو 2026 — دفتر يدوي','manual'),
('2026-06-30','70100',3002,'debit','مصاريف متغيرة يونيو 2026 — دفتر يدوي','manual'),
('2026-07-31','70100',6232,'debit','مصاريف متغيرة يوليو 2026 — دفتر يدوي','manual');

-- التكاليف الثابتة الشهرية المفصّلة لـ2026 (مؤكدة بالتحقق الرياضي مع الإجمالي)
insert into accounting_transactions (transaction_date, account_code, amount, direction, description, source) values
-- يناير
('2026-01-31','50100',7125,'debit','إيجار يناير 2026','manual'),
('2026-01-31','50200',2778,'debit','كهرباء يناير 2026','manual'),
('2026-01-31','50300',377,'debit','إنترنت يناير 2026','manual'),
('2026-01-31','50350',132,'debit','رسوم بنكية يناير 2026','manual'),
('2026-01-31','60200',800,'debit','تذاكر عمال يناير 2026','manual'),
('2026-01-31','50400',1500,'debit','صيانة يناير 2026','manual'),
-- فبراير
('2026-02-28','50100',7125,'debit','إيجار فبراير 2026','manual'),
('2026-02-28','50200',2788,'debit','كهرباء فبراير 2026','manual'),
('2026-02-28','50300',377,'debit','إنترنت فبراير 2026','manual'),
('2026-02-28','50350',132,'debit','رسوم بنكية فبراير 2026','manual'),
('2026-02-28','50400',2095,'debit','صيانة فبراير 2026','manual'),
-- مارس
('2026-03-31','50100',7125,'debit','إيجار مارس 2026','manual'),
('2026-03-31','50200',2178,'debit','كهرباء مارس 2026','manual'),
('2026-03-31','50300',377,'debit','إنترنت مارس 2026','manual'),
('2026-03-31','50350',132,'debit','رسوم بنكية مارس 2026','manual'),
('2026-03-31','60300',5230,'debit','تجديد تأشيرة مارس 2026','manual'),
-- أبريل
('2026-04-30','50100',7125,'debit','إيجار أبريل 2026','manual'),
('2026-04-30','50200',2637,'debit','كهرباء أبريل 2026','manual'),
('2026-04-30','50300',377,'debit','إنترنت أبريل 2026','manual'),
('2026-04-30','50350',132,'debit','رسوم بنكية أبريل 2026','manual'),
('2026-04-30','60200',1000,'debit','تذاكر عمال أبريل 2026','manual'),
('2026-04-30','50400',2500,'debit','صيانة أبريل 2026','manual'),
-- مايو
('2026-05-31','50100',7125,'debit','إيجار مايو 2026','manual'),
('2026-05-31','50200',3555,'debit','كهرباء مايو 2026','manual'),
('2026-05-31','50300',377,'debit','إنترنت مايو 2026','manual'),
('2026-05-31','50350',132,'debit','رسوم بنكية مايو 2026','manual'),
('2026-05-31','50400',2500,'debit','صيانة مايو 2026','manual'),
-- يونيو
('2026-06-30','50100',7125,'debit','إيجار يونيو 2026','manual'),
('2026-06-30','50200',4351,'debit','كهرباء يونيو 2026','manual'),
('2026-06-30','50300',377,'debit','إنترنت يونيو 2026','manual'),
('2026-06-30','50350',132,'debit','رسوم بنكية يونيو 2026','manual'),
-- يوليو
('2026-07-31','50100',7125,'debit','إيجار يوليو 2026','manual'),
('2026-07-31','50200',3509,'debit','كهرباء يوليو 2026','manual'),
('2026-07-31','50300',377,'debit','إنترنت يوليو 2026','manual'),
('2026-07-31','50350',132,'debit','رسوم بنكية يوليو 2026','manual'),
('2026-07-31','60300',16100,'debit','تجديد تأشيرة يوليو 2026','manual'),
('2026-07-31','50400',4890,'debit','صيانة يوليو 2026','manual');

-- مكافأة محمد علي (الأشهر الرابحة فقط: يناير، فبراير، أبريل، مايو)
insert into accounting_transactions (transaction_date, account_code, amount, direction, description, source, worker_id)
select d.month_date, '60100', d.amt, 'debit', 'مكافأة محمد علي (20% من الربح المعدّل) — '||d.month_label, 'manual',
       (select worker_id from workers where full_name = 'MUHAMMED ALI PULIKKAL USMAN PULIKKAL')
from (values
    ('2026-01-31'::date, 440,  'يناير 2026'),
    ('2026-02-28'::date, 89,   'فبراير 2026'),
    ('2026-04-30'::date, 2827, 'أبريل 2026'),
    ('2026-05-31'::date, 185,  'مايو 2026')
) as d(month_date, amt, month_label);
-- مارس، يونيو، يوليو 2026: بدون مكافأة (خسارة بالشهر)


-- ------------------------------------------------------------
-- 4) محرك المخصصات الشهرية (Monthly Accrual Engine)
--    view تحسب المستحق شهرياً لكل عامل بناءً على الأيام المتبقية
--    فعلياً حتى تاريخ الاستحقاق (نموذج تنازلي دقيق، مو متوسط ثابت)
-- ------------------------------------------------------------
create or replace view worker_monthly_accruals as
select
    w.worker_id,
    w.full_name,

    -- مخصص التأشيرة الشهري
    round(
        coalesce(w.visa_last_cost, 4500) /
        greatest(1, extract(month from age(w.visa_expiry_date, current_date))
                  + extract(year from age(w.visa_expiry_date, current_date)) * 12)
    , 2) as monthly_visa_accrual,
    w.visa_expiry_date,

    -- مخصص التذكرة الشهري
    round(
        w.ticket_cost /
        greatest(1, extract(month from age(w.ticket_due_date, current_date))
                  + extract(year from age(w.ticket_due_date, current_date)) * 12)
    , 2) as monthly_ticket_accrual,
    w.ticket_due_date

from workers w
where w.is_active = true;


-- ------------------------------------------------------------
-- 5) تقرير الربح والخسارة الشهري (P&L View)
-- ------------------------------------------------------------
create or replace view monthly_pnl as
select
    date_trunc('month', t.transaction_date) as month,
    coa.account_type,
    coa.account_code,
    coa.account_name_ar,
    sum(case when coa.account_type = 'revenue' then t.amount
             when coa.account_type = 'expense' then -t.amount
             else 0 end) as net_amount
from accounting_transactions t
join chart_of_accounts coa on coa.account_code = t.account_code
where coa.account_type in ('revenue','expense')
group by 1,2,3,4
order by 1,2,3;


-- ------------------------------------------------------------
-- 5ب) ترحيل الخسارة الشهرية (Loss Carry-Forward)
--     قاعدة دائمة: لو شهر خسارة، الخسارة تُخصم من ربح الشهر التالي
--     قبل حساب نسبة الأرباح (لمحمد علي وأي عامل fixed_plus_profit_share
--     مستقبلاً). لو الشهر التالي لسا خسارة بعد الخصم، ترحّل بدورها.
-- ------------------------------------------------------------
create or replace view monthly_profit_carryforward as
with recursive month_totals as (
    select
        month,
        sum(net_amount) filter (where account_type = 'revenue') as gross_revenue,
        sum(net_amount) as net_profit  -- net_amount بـmonthly_pnl مصاريفها سالبة أصلاً، فالمجموع المباشر = الصافي
    from monthly_pnl
    group by month
),
ordered as (
    select *, row_number() over (order by month) as rn
    from month_totals
),
recursive_calc as (
    select
        month, rn, net_profit, gross_revenue,
        net_profit as adjusted_profit,
        least(net_profit, 0) as carry_forward
    from ordered where rn = 1
    union all
    select
        o.month, o.rn, o.net_profit, o.gross_revenue,
        o.net_profit + r.carry_forward as adjusted_profit,
        least(o.net_profit + r.carry_forward, 0) as carry_forward
    from ordered o
    join recursive_calc r on o.rn = r.rn + 1
)
select
    month, gross_revenue, net_profit,
    adjusted_profit,
    greatest(adjusted_profit, 0) as profit_share_base  -- أساس حساب نسبة الأرباح بعد الترحيل
from recursive_calc
order by month;


-- ------------------------------------------------------------
-- 5ج) الرواتب المستحقة شهرياً — يشمل الأنواع الثلاثة:
--     ثابت (fixed) / عمولة من الدخل (revenue_share) / ثابت+نسبة أرباح
--     ملاحظة: revenue_share و fixed_plus_profit_share يعتمدان على
--     أرقام الشهر من monthly_pnl، فلازم تكون قيود الشهر مُدخلة كاملة
--     قبل حساب رواتب هذين العاملين. fixed_plus_profit_share يستخدم
--     profit_share_base (بعد ترحيل خسارة الشهر السابق إن وُجدت).
-- ------------------------------------------------------------
create or replace view worker_payroll_monthly as
select
    w.worker_id,
    w.full_name,
    w.compensation_type,
    mc.month,
    case w.compensation_type
        when 'fixed' then w.gross_salary
        when 'revenue_share' then round(coalesce(mc.gross_revenue,0) * w.variable_pct / 100, 2)
        when 'fixed_plus_profit_share' then
            coalesce(w.basic_salary,0) + round(coalesce(mc.profit_share_base,0) * w.variable_pct / 100, 2)
    end as amount_due
from workers w
cross join monthly_profit_carryforward mc
where w.is_active = true
order by mc.month desc, w.full_name;


-- ------------------------------------------------------------
-- ------------------------------------------------------------
-- 6) نقطة التواصل مع المنظومة الأكبر (Integration Export)
--    View واحد فقط يُقرأ من الخارج — رقم الربح الشهري الصافي.
--    الشعلة تبقى نظاماً مستقلاً بالكامل؛ هذا هو المخرج الوحيد
--    الذي تراه المنظومة الأكبر، بدون أي تفاصيل تشغيلية داخلية.
-- ------------------------------------------------------------
create or replace view shulah_monthly_profit_export as
select
    date_trunc('month', p.month)::date as month,
    sum(case when p.account_type = 'revenue' then p.net_amount else 0 end) as total_revenue,
    sum(case when p.account_type = 'expense' then p.net_amount else 0 end) as total_expense,
    sum(p.net_amount) as net_profit
from monthly_pnl p
group by 1
order by 1;

-- ============================================================
-- 7) التسجيل اليومي (Daily Entries) — يبدأ فعلياً 1/9/2026
--    مبدأ محاسبي معتمد: كل عملية تُسجَّل مرة واحدة بالتطبيق (مستند
--    مصدر)، وتتحول تلقائياً لقيد بدفتر accounting_transactions عبر trigger —
--    بدون أي إدخال يدوي مزدوج، ومع أثر تدقيق (audit trail) كامل
--    يربط كل قيد مالي بمصدره الأصلي (reference_id).
-- ============================================================
create table daily_service_entries (
    entry_id        uuid primary key default gen_random_uuid(),
    entry_date      date not null default current_date,
    entry_time      time default current_time,
    service_type    text not null check (service_type in ('wash','detailing','other')),
    amount          numeric(10,2) not null check (amount > 0),
    payment_method  text check (payment_method in ('cash','card','other')),  -- يفيد لاحقاً بتسوية الكاش/POS مع 10100/10300
    staff_id        uuid references workers(worker_id),  -- العامل المنفّذ (اختياري)
    notes           text,
    is_voided       boolean default false,  -- إلغاء منطقي بدل الحذف الفعلي (audit trail)
    created_at      timestamptz default now()
);

create index idx_daily_entries_date on daily_service_entries(entry_date);

-- الربط التلقائي: كل عملية جديدة تتحول لقيد إيراد فوراً بالحساب المناسب
create or replace function post_daily_entry_to_ledger()
returns trigger as $$
declare
    v_account varchar(5);
begin
    v_account := case new.service_type
        when 'wash' then '40100'
        when 'detailing' then '40200'
        else '40300'
    end;

    insert into accounting_transactions (transaction_date, account_code, amount, direction, description, source, reference_id)
    values (new.entry_date, v_account, new.amount, 'credit',
            'تسجيل يومي — ' || new.service_type || coalesce(' — ' || new.notes, ''),
            'daily_app', new.entry_id);

    return new;
end;
$$ language plpgsql;

create trigger trg_post_daily_entry
    after insert on daily_service_entries
    for each row
    when (new.is_voided = false)
    execute function post_daily_entry_to_ledger();

-- ملاحظة: عند إلغاء عملية (is_voided = true بعد الإدخال)، يُضاف قيد
-- عكسي يدوياً بحساب نفس service_type بمبلغ سالب، مربوط بنفس reference_id،
-- بدل حذف القيد الأصلي (يحافظ على الأثر المحاسبي الكامل).

-- استخدام المنظومة الأكبر: select * from shulah_monthly_profit_export order by month desc limit 1;
-- ============================================================

-- ------------------------------------------------------------
-- أمان: نفس مبدأ 0001_init.sql — كل الجداول محمية بـ RLS بدون أي
-- policy عامة، فالوصول الوحيد الممكن هو عبر مفتاح service_role من
-- كود الخادم (لا يصل أبداً لمتصفح المستخدم). ضروري هنا خصوصاً —
-- الجداول تحتوي رواتب العمال وأرقام جوازاتهم.
-- ------------------------------------------------------------
alter table entities enable row level security;
alter table chart_of_accounts enable row level security;
alter table workers enable row level security;
alter table worker_leaves enable row level security;
alter table accounting_transactions enable row level security;
alter table daily_service_entries enable row level security;
