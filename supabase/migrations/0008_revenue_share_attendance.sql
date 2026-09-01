-- تصحيح إضافي على worker_payroll_monthly (بعد 0007): عمولة revenue_share (زكريا) تتوقف
-- بالإجازة أيضاً — نفس معادلة التناسب المطبّقة على الراتب الثابت (أيام الحضور ÷ أيام الشهر)،
-- بدل ما تستمر كاملة بغض النظر عن الإجازة كما كانت بـ0007.
-- fixed و fixed_plus_profit_share بدون تغيير عن 0007.

create or replace view worker_payroll_monthly as
with attendance as (
    select
        w.worker_id,
        mc.month,
        extract(day from (mc.month + interval '1 month - 1 day')) as days_in_month,
        extract(day from (mc.month + interval '1 month - 1 day'))
            - coalesce(sum(
                least(coalesce(wl.leave_end, current_date), (mc.month + interval '1 month - 1 day')::date)
                - greatest(wl.leave_start, mc.month::date)
                + 1
              ) filter (where wl.leave_start <= (mc.month + interval '1 month - 1 day')::date
                          and coalesce(wl.leave_end, current_date) >= mc.month::date), 0)
            as days_present
    from workers w
    cross join monthly_profit_carryforward mc
    left join worker_leaves wl on wl.worker_id = w.worker_id
    where w.is_active = true
    group by w.worker_id, mc.month
)
select
    w.worker_id,
    w.full_name,
    w.compensation_type,
    mc.month,
    case w.compensation_type
        when 'fixed' then
            round(w.gross_salary * a.days_present / nullif(a.days_in_month, 0), 2)
        when 'revenue_share' then
            round(coalesce(mc.gross_revenue, 0) * w.variable_pct / 100 * a.days_present / nullif(a.days_in_month, 0), 2)
        when 'fixed_plus_profit_share' then
            round(coalesce(w.basic_salary, 0) * a.days_present / nullif(a.days_in_month, 0), 2)
            + round(coalesce(mc.profit_share_base, 0) * w.variable_pct / 100, 2)
    end as amount_due
from workers w
cross join monthly_profit_carryforward mc
join attendance a on a.worker_id = w.worker_id and a.month = mc.month
where w.is_active = true
order by mc.month desc, w.full_name;
