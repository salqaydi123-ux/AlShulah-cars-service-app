-- تصحيح إضافي على monthly_profit_carryforward (بعد 0009): المشتريات (70100) تخرج من نطاق
-- الرقم الثابت وترجع تُحسب فعلية — لأنها متغيّرة حسب حجم الشغل (كل ما زاد الشغل زادت
-- المشتريات)، بخلاف باقي المصاريف (إيجار، كهرباء، اتصالات، رسوم بنكية، صيانة، رخصة، تجديد
-- سيارة، مخصصات تذاكر/تأشيرات) اللي تبقى تحت رقم ثابت. والرقم الثابت نفسه يرجع لـ18,000
-- بدل 24,000 (بعد إخراج تقدير المشتريات منه).
--
-- بداية من سبتمبر 2026:
--   صافي الربح (لغرض المكافأة) = الإيراد − الرواتب الفعلية (60100) − المشتريات الفعلية (70100) − 18,000
-- هذا يطابق بالضبط الطريقة اليدوية القديمة كما هي (دفتر يناير 2026: 40542 − 14393 − 5947 − 18000 = 2202،
-- 20% منها = 440) — المشتريات فعلية دائماً، والباقي (غير الرواتب والمشتريات) رقم ثابت 18,000
-- بغض النظر عن الفعلي المسجَّل، أقل كان أو أكثر.
--
-- الأشهر قبل سبتمبر 2026 بدون أي تغيير. نفس نطاق 0009: يقتصر على monthly_profit_carryforward
-- (ومنه profit_share_base بجدول worker_payroll_monthly) فقط — لا يمسّ monthly_pnl ولا
-- shulah_monthly_profit_export ولا accounting_transactions.

create or replace view monthly_profit_carryforward as
with recursive month_totals as (
    select
        month,
        sum(net_amount) filter (where account_type = 'revenue') as gross_revenue,
        case
            when month >= '2026-09-01' then
                sum(net_amount) filter (where account_type = 'revenue')
                + coalesce(sum(net_amount) filter (where account_type = 'expense' and account_code = '60100'), 0)
                + coalesce(sum(net_amount) filter (where account_type = 'expense' and account_code = '70100'), 0)
                - 18000
            else
                sum(net_amount)
        end as net_profit
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
    greatest(adjusted_profit, 0) as profit_share_base
from recursive_calc
order by month;
