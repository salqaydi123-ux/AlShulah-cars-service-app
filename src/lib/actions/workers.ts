'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { VisaInput, WorkerOverviewRow } from '@/lib/types';

export async function getWorkersOverview(): Promise<WorkerOverviewRow[]> {
  const db = supabaseAdmin();
  const [workersRes, openLeavesRes] = await Promise.all([
    db
      .from('workers')
      .select('worker_id, full_name, compensation_type, visa_issue_date, visa_expiry_date, visa_last_cost')
      .eq('is_active', true)
      .order('full_name'),
    db.from('worker_leaves').select('worker_id, leave_start').is('leave_end', null),
  ]);
  if (workersRes.error) throw new Error(workersRes.error.message);
  if (openLeavesRes.error) throw new Error(openLeavesRes.error.message);

  const openLeaveByWorker = new Map<string, string>((openLeavesRes.data ?? []).map((r: any) => [r.worker_id, r.leave_start]));

  return (workersRes.data ?? []).map((w: any) => ({
    worker_id: w.worker_id,
    full_name: w.full_name,
    compensation_type: w.compensation_type,
    on_leave: openLeaveByWorker.has(w.worker_id),
    leave_start: openLeaveByWorker.get(w.worker_id) ?? null,
    visa_issue_date: w.visa_issue_date,
    visa_expiry_date: w.visa_expiry_date,
    visa_last_cost: w.visa_last_cost !== null ? Number(w.visa_last_cost) : null,
  }));
}

// إجازة واحدة مفتوحة (leave_end فاضي) بالكثير لكل عامل — يمنع فتح إجازة ثانية قبل تسجيل عودة
// من الحالية، تفادياً لتضارب حساب أيام الحضور بفورم الرواتب (worker_payroll_monthly).
export async function startLeave(workerId: string, leaveStart: string): Promise<void> {
  if (!leaveStart) throw new Error('حدد تاريخ بداية الإجازة');

  const db = supabaseAdmin();
  const { data: existing, error: checkErr } = await db
    .from('worker_leaves')
    .select('leave_id')
    .eq('worker_id', workerId)
    .is('leave_end', null)
    .maybeSingle();
  if (checkErr) throw new Error(checkErr.message);
  if (existing) throw new Error('العامل بإجازة مفتوحة أصلاً — سجّل عودته أولاً قبل تسجيل إجازة جديدة');

  const { error } = await db.from('worker_leaves').insert({ worker_id: workerId, leave_start: leaveStart, leave_end: null, leave_type: 'annual' });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/workers');
}

// تسجيل العودة يحدّث leave_end بالإجازة المفتوحة، ويحدّث workers.last_return_date بنفس التاريخ —
// نفس ما سوّاه ملف الترحيل الأصلي يدوياً، لأن last_return_date يغذّي ticket_due_date (تاريخ
// استحقاق التذكرة السنوية) المحسوب تلقائياً بالجدول.
export async function endLeave(workerId: string, leaveEnd: string): Promise<void> {
  if (!leaveEnd) throw new Error('حدد تاريخ العودة');

  const db = supabaseAdmin();
  const { data: open, error: findErr } = await db
    .from('worker_leaves')
    .select('leave_id, leave_start')
    .eq('worker_id', workerId)
    .is('leave_end', null)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!open) throw new Error('ما فيه إجازة مفتوحة لهذا العامل');
  if (leaveEnd < open.leave_start) throw new Error('تاريخ العودة قبل تاريخ بداية الإجازة');

  const { error: updErr } = await db.from('worker_leaves').update({ leave_end: leaveEnd }).eq('leave_id', open.leave_id);
  if (updErr) throw new Error(updErr.message);

  const { error: workerErr } = await db
    .from('workers')
    .update({ last_return_date: leaveEnd, updated_at: new Date().toISOString() })
    .eq('worker_id', workerId);
  if (workerErr) throw new Error(workerErr.message);

  revalidatePath('/admin/workers');
  revalidatePath('/admin/finance');
}

export async function updateVisa(workerId: string, input: VisaInput): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from('workers')
    .update({
      visa_issue_date: input.visaIssueDate || null,
      visa_expiry_date: input.visaExpiryDate || null,
      visa_last_cost: input.visaLastCost,
      updated_at: new Date().toISOString(),
    })
    .eq('worker_id', workerId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/workers');
}
