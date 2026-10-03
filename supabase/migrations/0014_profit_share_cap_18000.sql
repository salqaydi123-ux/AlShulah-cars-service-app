-- تصحيح على monthly_profit_carryforward (0009): الحد الثابت المخصوم لغرض حساب مكافأة الأرباح
-- (fixed_plus_profit_share — محمد علي) يرجع لـ 18,000 د.إ شهرياً بدل 24,000 — هذا هو الرقم
-- المتفق عليه أصلاً مع صاحب العمل، و24,000 كانت تقدير إضافي غير دقيق. الصيغة (مطابقة تماماً
-- لمثال الطريقة اليدوية القديمة بدفتر يناير 2026: 40542 − 14393 − 5947 − 18000 = 2202):
--   صافي الربح (لغرض المكافأة) = الإيراد − الرواتب الفعلية − المشتريات الفعلية − 18,000 ثابت
-- الرواتب (60100) والمشتريات (70100) تُخصم بقيمتهما الفعلية الحقيقية كما تُدخَل بالنظام —
-- الـ18,000 الثابت يغطي فقط باقي البنود المتفق عليها (إيجار، كهرباء، اتصالات، رسوم بنكية،
-- صيانة، رخصة، تجديد سيارة...)، مو المشتريات ولا الرواتب. أي زيادة فعلية بهذي البنود المتبقية
-- عن 18,000 تُغطّى من رصيد البنك المتراكم من شهور سابقة (ما تُخصم من ربح الشهر)، وأي نقص عن
-- 18,000 يبقى بالبنك (ما يُحسب ربح إضافي).
--
-- الأشهر قبل سبتمبر 2026 بدون أي تغيير — القرار يبدأ من سبتمبر فقط، مو بأثر رجعي.

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
