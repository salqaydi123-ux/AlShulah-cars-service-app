// وكيل الشعلة الفرعي (finance-alshulah) — Supabase Edge Function (Deno)
// ينفّذ عقد get_summary / answer_query الذي يتوقعه الـ Main Agent Router
// (مشروع Supabase منفصل تماماً). هذا الوكيل يقرأ فقط من قاعدة بيانات هذا
// التطبيق نفسها (التسجيل اليومي + دفتر الحسابات) — لا يتصل بأي مشروع آخر.
//
// الأسرار المطلوبة (supabase secrets set):
//   AGENT_KEY          — يطابق AGENT_KEY_FINANCE_ALSHULAH بمشروع الـ Router
//   ANTHROPIC_API_KEY  — لتوليد إجابات answer_query
// SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY تُحقنان تلقائياً من Supabase لكل Edge Function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AGENT_KEY = Deno.env.get("AGENT_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const ANSWER_MODEL = Deno.env.get("ANSWER_MODEL") ?? "claude-sonnet-5";
const PENDING_RECEIVABLES_ALERT = 5000; // د.إ — عتبة تنبيه الذمم الآجلة العالية

const db = createClient(SUPABASE_URL, SERVICE_KEY);

type Capability = "get_summary" | "answer_query";
type AgentResponse = {
  status: "ok" | "needs_input" | "error";
  summary: string;
  flags?: string[];
};

// ---------- لقطة مالية مجمّعة فقط (بدون أي بيانات شخصية عن العمال) ----------
async function loadFinancialSnapshot() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const [{ data: monthlyExport }, { data: monthToDate }, { data: pendingRows }, { data: payroll }] =
    await Promise.all([
      db.from("shulah_monthly_profit_export").select("*").order("month", { ascending: false }).limit(6),
      db.from("transactions").select("total").gte("tx_date", monthStartStr),
      db.from("transactions").select("total").eq("pay_status", "pending"),
      db.from("worker_payroll_monthly").select("amount_due, month").order("month", { ascending: false }).limit(50),
    ]);

  const monthToDateTotal = (monthToDate ?? []).reduce((s, r: any) => s + Number(r.total ?? 0), 0);
  const monthToDateCount = (monthToDate ?? []).length;
  const pendingTotal = (pendingRows ?? []).reduce((s, r: any) => s + Number(r.total ?? 0), 0);

  const latestMonth = monthlyExport?.[0] ?? null;
  const latestPayrollMonth = payroll?.[0]?.month ?? null;
  const latestPayrollTotal = (payroll ?? [])
    .filter((r: any) => r.month === latestPayrollMonth)
    .reduce((s, r: any) => s + Number(r.amount_due ?? 0), 0);

  return {
    monthlyExport: monthlyExport ?? [],
    monthToDateTotal,
    monthToDateCount,
    pendingTotal,
    latestMonth,
    latestPayrollMonth,
    latestPayrollTotal,
  };
}

type Snapshot = Awaited<ReturnType<typeof loadFinancialSnapshot>>;

function deriveFlags(snapshot: Snapshot): string[] {
  const flags: string[] = [];
  if (snapshot.latestMonth && Number(snapshot.latestMonth.net_profit) < 0) flags.push("monthly_loss");
  if (snapshot.pendingTotal > PENDING_RECEIVABLES_ALERT) flags.push("high_pending_receivables");
  return flags;
}

function formatSummary(snapshot: Snapshot): string {
  const m = snapshot.latestMonth as { month: string; total_revenue: number; total_expense: number; net_profit: number } | null;
  const lines: string[] = [];

  lines.push(
    m
      ? `آخر شهر مقفل (${String(m.month).slice(0, 7)}): إيراد ${Number(m.total_revenue).toLocaleString("ar-AE")} د.إ، ` +
        `مصروف ${Number(m.total_expense).toLocaleString("ar-AE")} د.إ، صافي ${Number(m.net_profit).toLocaleString("ar-AE")} د.إ.`
      : "لا توجد بيانات شهرية مقفلة بعد."
  );
  lines.push(
    `الشهر الحالي حتى الآن: ${snapshot.monthToDateCount} عملية بإجمالي ${snapshot.monthToDateTotal.toLocaleString("ar-AE")} د.إ.`
  );
  if (snapshot.pendingTotal > 0) {
    lines.push(`ذمم آجلة غير محصّلة: ${snapshot.pendingTotal.toLocaleString("ar-AE")} د.إ.`);
  }
  if (snapshot.latestPayrollMonth) {
    lines.push(
      `رواتب مستحقة عن ${String(snapshot.latestPayrollMonth).slice(0, 7)}: ${snapshot.latestPayrollTotal.toLocaleString("ar-AE")} د.إ.`
    );
  }
  return lines.join(" ");
}

// ---------- answer_query: إجابة LLM مبنية فقط على نفس اللقطة المجمّعة ----------
async function answerQuery(query: string, snapshot: Snapshot): Promise<string> {
  const system =
    "أنت الوكيل المالي لمغسلة الشعلة لخدمة السيارات (كلباء). أجب فقط بالاعتماد على البيانات المرفقة، " +
    "بلا أرقام أو تخمينات غير موجودة فيها. أجب بنفس لغة السؤال، بإيجاز وعملية.";
  const user = `السؤال:\n${query}\n\nالبيانات المتاحة:\n${JSON.stringify({
    monthly_trend: snapshot.monthlyExport,
    month_to_date: { total: snapshot.monthToDateTotal, count: snapshot.monthToDateCount },
    pending_receivables_total: snapshot.pendingTotal,
    latest_payroll: { month: snapshot.latestPayrollMonth, total: snapshot.latestPayrollTotal },
  })}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: ANSWER_MODEL, max_tokens: 800, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(`Claude API ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (req.headers.get("x-agent-key") !== AGENT_KEY) return new Response("Unauthorized", { status: 401 });

  let capability: Capability;
  let query: string;
  try {
    const body = await req.json();
    query = body?.query;
    capability = body?.capability;
    if (typeof query !== "string" || !query.trim()) throw new Error();
    if (capability !== "get_summary" && capability !== "answer_query") throw new Error();
  } catch {
    return Response.json(
      {
        status: "error",
        summary: 'body must be {"capability": "get_summary"|"answer_query", "query": string}',
      } satisfies AgentResponse,
      { status: 400 }
    );
  }

  let snapshot: Snapshot;
  try {
    snapshot = await loadFinancialSnapshot();
  } catch (e) {
    return Response.json({ status: "error", summary: `data_unavailable: ${(e as Error).message}` } satisfies AgentResponse);
  }

  const flags = deriveFlags(snapshot);

  if (capability === "get_summary") {
    return Response.json({ status: "ok", summary: formatSummary(snapshot), flags } satisfies AgentResponse);
  }

  try {
    const summary = await answerQuery(query, snapshot);
    return Response.json({ status: "ok", summary, flags } satisfies AgentResponse);
  } catch (e) {
    return Response.json({ status: "error", summary: `answer_failed: ${(e as Error).message}` } satisfies AgentResponse);
  }
});
