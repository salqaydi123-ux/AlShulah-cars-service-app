-- تصحيح على monthly_profit_carryforward: بداية من سبتمبر 2026، أساس حساب مكافأة الأرباح
-- (fixed_plus_profit_share — محمد علي) يستخدم رقماً ثابتاً 24,000 د.إ شهرياً بدل المصاريف
-- التشغيلية الفعلية المفصّلة (كل شيء ما عدا الرواتب 60100 — إيجار، كهرباء، اتصالات، رسوم
-- بنكية، صيانة، رخصة، تجديد سيارة، مخصصات تذاكر/تأشيرات، ومشتريات). هذا بديل كامل وليس حداً
-- أدنى (max) — يُخصم 24,000 كما هو دائماً بغض النظر عن الفعلي المسجَّل، أقل كان أو أكثر:
--   صافي الربح (لغرض المكافأة) = الإيراد − الرواتب الفعلية − 24,000
-- نفس أسلوب الطريقة اليدوية القديمة بالضبط (دفتر يناير 2026: 40542 − 14393 − 5947 − 18000 = 2202،
-- 20% منها = 440 — الفرق بين 18000 الثابت والمصاريف التفصيلية الحقيقية كان يبقى "رصيد بالبنك"
-- بدون ما يدخل بحساب الربح إطلاقاً)، بس برقم 24,000 بدل 18,000 (يشمل تقدير المشتريات ~6,000).
-- الرواتب نفسها تبقى دائماً بمبلغها الفعلي الحقيقي، خارج الرقم الثابت.
--
-- الأشهر قبل سبتمبر 2026 بدون أي تغيير (صافي الربح الفعلي كما هو) — القرار يبدأ من سبتمبر
-- فقط، مو بأثر رجعي على أشهر "مقفلة" مسبقاً.
--
-- مهم: هذا التعديل يقتصر على monthly_profit_carryforward (ومنه profit_share_base بجدول
-- worker_payroll_monthly) فقط. لا يمسّ monthly_pnl ولا shulah_monthly_profit_export ولا
-- accounting_transactions — "صافي الربح" المعروض بالتقرير المالي (/admin/finance) وأي تصدير
-- يبقى الرقم الحقيقي 100% بدون أي تعديل، تماماً كما هو الآن.

create or replace view monthly_profit_carryforward as
with recursive month_totals as (
    select
        month,
        sum(net_amount) filter (where account_type = 'revenue') as gross_revenue,
        case
            when month >= '2026-09-01' then
                sum(net_amount) filter (where account_type = 'revenue')
                + coalesce(sum(net_amount) filter (where account_type = 'expense' and account_code = '60100'), 0)
                - 24000
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
