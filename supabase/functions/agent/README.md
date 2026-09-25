# وكيل الشعلة الفرعي (finance-alshulah)

Supabase Edge Function تنفّذ عقد `get_summary` / `answer_query` الذي يستدعيه
الـ **Main Agent Router** (مشروع Supabase منفصل تماماً يجمع بين عدة "وكلاء
مجال" — مالية شخصية، عمل، صحة... إلخ). هذا الوكيل مسؤول فقط عن مجال مالية
الشعلة، ويقرأ حصراً من قاعدة بيانات هذا المشروع.

## النشر — تلقائي عبر GitHub Actions (مرة وحدة فقط للإعداد)

أي دفعة لفرع `claude/car-wash-web-app-hmk9vw` تلمس `supabase/functions/**`
تنشر تلقائياً عبر
[`.github/workflows/deploy-agent.yml`](../../../.github/workflows/deploy-agent.yml).

**إعداد لمرة وحدة**: بمستودع GitHub هذا → **Settings → Secrets and
variables → Actions**، أضف:

| الاسم | القيمة |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Personal Access Token من نفس حساب Supabase الحقيقي للشعلة |
| `AGENT_KEY` | سر عشوائي طويل — **يجب يطابق حرفياً** `AGENT_KEY_FINANCE_ALSHULAH` بمستودع main-agent-router |
| `ANTHROPIC_API_KEY` | مفتاح Anthropic |

**النشر اليدوي القديم** (احتياطي فقط):

```bash
supabase functions deploy agent --no-verify-jwt --project-ref <ALSHULAH_PROJECT_REF>
supabase secrets set AGENT_KEY=<...> ANTHROPIC_API_KEY=<...> --project-ref <ALSHULAH_PROJECT_REF>
```

`SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` تُحقنان تلقائياً من Supabase لكل
Edge Function — لا حاجة لضبطهما يدوياً.

## الربط مع مشروع الـ Router

في جدول `agent_registry` **بمشروع الـ Router** (وليس هنا)، حدّث صف
`finance-alshulah`:

```sql
update agent_registry
set endpoint_url = 'https://<ALSHULAH_PROJECT_REF>.supabase.co/functions/v1/agent'
where id = 'finance-alshulah';
```

وأضف بمشروع الـ Router سرّاً باسم `AGENT_KEY_FINANCE_ALSHULAH` بنفس قيمة
`AGENT_KEY` أعلاه — هذا هو السر المشترك بين الاثنين.

## العقد

طلب من الـ Router:

```json
{ "capability": "get_summary" | "answer_query", "query": "...", "caller": "main" }
```
Header: `x-agent-key: <AGENT_KEY>`, `x-request-id: <uuid>`

رد الوكيل:

```json
{ "status": "ok" | "needs_input" | "error", "summary": "...", "flags": ["monthly_loss", "high_pending_receivables"] }
```

- `get_summary`: ملخص مباشر من قاعدة البيانات (آخر شهر مقفل من
  `shulah_monthly_profit_export`، الشهر الحالي حتى الآن، الذمم الآجلة،
  آخر رواتب مستحقة) — بدون أي استدعاء LLM.
- `answer_query`: نفس اللقطة المجمّعة تُمرَّر كسياق لـ Claude ليجيب على سؤال
  حر بنفس لغته، دون اختراع أرقام غير موجودة بالبيانات.

لا تُضمَّن أي بيانات شخصية عن العمال (أسماء، جوازات، رواتب فردية) في اللقطة —
فقط إجماليات مالية، لأن `finance-alshulah` مسجّل بمشروع الـ Router كـ
`exposes_to_main: summary_only`.
