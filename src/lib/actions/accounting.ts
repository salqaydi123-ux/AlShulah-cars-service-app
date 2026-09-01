'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ExpenseAccountOption, PayrollMonthRow } from '@/lib/types';

// حسابات المصاريف المسموح اختيارها بفورم "مصاريف شهرية": المصاريف الثابتة (50xxx) +
// المخصصات الفعلية عند دفعها (60200 تذاكر، 60300 تأشيرات) + المشتريات المتغيرة (70100).
// 60100 (رواتب العمال) مستثنى عمداً — له فورم مستقل يسحب المستحق تلقائياً من worker_payroll_monthly.
function isExpenseAccount(code: string): boolean {
  return code.startsWith('50') || code === '60200' || code === '60300' || code === '70100';
}

// آخر يوم بالشهر بدون أي اعتماد على المنطقة الزمنية المحلية للخادم — Date.UTC فقط.
function lastDayOfMonth(year: number, month1to12: number): string {
  const lastDay = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  return `${year}-${String(month1to12).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function monthEndFromMonthStart(monthStart: string): string {
  const [y, m] = monthStart.split('-').map(Number);
  return lastDayOfMonth(y, m);
}

function arabicMonthLabel(monthStart: string): string {
  return new Date(`${monthStart}T00:00:00Z`).toLocaleDateString('ar-AE', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export async function getExpenseAccounts(): Promise<ExpenseAccountOption[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('chart_of_accounts')
    .select('account_code, account_name_ar')
    .eq('is_active', true)
    .order('account_code');
  if (error) throw new Error(error.message);
  return (data ?? []).filter((r: any) => isExpenseAccount(r.account_code));
}

export interface SubmitExpenseInput {
  accountCode: string;
  amount: number;
  month: string; // 'YYYY-MM-01'
}

export async function submitExpense(input: SubmitExpenseInput): Promise<void> {
  if (!input.accountCode) throw new Error('اختر الحساب');
  if (!input.amount || input.amount <= 0) throw new Error('أدخل مبلغاً صحيحاً');

  const db = supabaseAdmin();
  const { data: account, error: accErr } = await db
    .from('chart_of_accounts')
    .select('account_name_ar')
    .eq('account_code', input.accountCode)
    .maybeSingle();
  if (accErr) throw new Error(accErr.message);
  if (!account) throw new Error('الحساب غير موجود');

  const transactionDate = monthEndFromMonthStart(input.month);
  const description = `${account.account_name_ar} ${arabicMonthLabel(input.month)}`;

  const { error } = await db.from('accounting_transactions').insert({
    transaction_date: transactionDate,
    account_code: input.accountCode,
    amount: input.amount,
    direction: 'debit',
    description,
    source: 'manual',
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/finance');
}

// الرواتب التاريخية (أبريل 2025 - يوليو 2026) مُسجَّلة كمبلغ إجمالي شهري واحد بدون worker_id —
// فحص already_posted بالأسفل يعتمد على worker_id فما يكتشفها. الحد الأدنى هنا يمنع اختيار أي
// شهر قديم فيه قيد راتب مسبق أصلاً، فيتفادى ازدواج التسجيل.
const PAYROLL_MIN_MONTH = '2026-09-01';

// شهر لسا ما خلص = بياناته غير مكتملة (revenue_share/profit_share تُحسب على إيراد جزئي فقط)،
// والراتب الثابت يطلع كامل رغم مرور يوم أو يومين بس (لأن التناسب مبني على أيام الإجازة، مو على
// كم يوم مر فعلياً من الشهر) — لازم ننتظر الشهر يخلص كامل قبل ما نعرضه بفورم الرواتب.
function currentMonthStart(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export async function getPayrollMonths(): Promise<string[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('worker_payroll_monthly')
    .select('month')
    .gte('month', PAYROLL_MIN_MONTH)
    .lt('month', currentMonthStart())
    .order('month', { ascending: false });
  if (error) throw new Error(error.message);
  const months = new Set<string>((data ?? []).map((r: any) => String(r.month).slice(0, 10)));
  return Array.from(months);
}

async function alreadyPostedWorkerIds(db: ReturnType<typeof supabaseAdmin>, month: string, workerIds: string[]): Promise<Set<string>> {
  if (workerIds.length === 0) return new Set();
  const monthEnd = monthEndFromMonthStart(month);
  const { data, error } = await db
    .from('accounting_transactions')
    .select('worker_id')
    .eq('account_code', '60100')
    .eq('source', 'manual')
    .in('worker_id', workerIds)
    .gte('transaction_date', month)
    .lte('transaction_date', monthEnd);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r: any) => r.worker_id).filter(Boolean));
}

export async function getPayrollForMonth(month: string): Promise<PayrollMonthRow[]> {
  if (month < PAYROLL_MIN_MONTH) throw new Error('هذا الشهر غير متاح لفورم الرواتب — راجع الملاحظة بالأعلى');
  if (month >= currentMonthStart()) throw new Error('هذا الشهر لسا ما خلص — الأرقام تبقى غير مكتملة لحد نهاية الشهر');

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('worker_payroll_monthly')
    .select('worker_id, full_name, compensation_type, amount_due')
    .eq('month', month);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const posted = await alreadyPostedWorkerIds(db, month, rows.map((r: any) => r.worker_id));

  return rows
    .map((r: any) => ({
      worker_id: r.worker_id,
      full_name: r.full_name,
      compensation_type: r.compensation_type,
      amount_due: Number(r.amount_due),
      already_posted: posted.has(r.worker_id),
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
}

export interface SubmitPayrollResult {
  postedCount: number;
  skippedCount: number;
}

export async function submitPayroll(month: string, workerIds: string[]): Promise<SubmitPayrollResult> {
  if (month < PAYROLL_MIN_MONTH) throw new Error('هذا الشهر غير متاح لفورم الرواتب — راجع الملاحظة بالأعلى');
  if (month >= currentMonthStart()) throw new Error('هذا الشهر لسا ما خلص — الأرقام تبقى غير مكتملة لحد نهاية الشهر');
  if (workerIds.length === 0) return { postedCount: 0, skippedCount: 0 };

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('worker_payroll_monthly')
    .select('worker_id, full_name, amount_due')
    .eq('month', month)
    .in('worker_id', workerIds);
  if (error) throw new Error(error.message);

  const candidates = data ?? [];
  const posted = await alreadyPostedWorkerIds(db, month, workerIds);
  const monthLabel = arabicMonthLabel(month);
  const transactionDate = monthEndFromMonthStart(month);

  const toInsert = candidates
    .filter((r: any) => !posted.has(r.worker_id) && Number(r.amount_due) > 0)
    .map((r: any) => ({
      transaction_date: transactionDate,
      account_code: '60100',
      amount: Number(r.amount_due),
      direction: 'debit' as const,
      description: `راتب ${monthLabel} — ${r.full_name}`,
      source: 'manual',
      worker_id: r.worker_id,
    }));

  if (toInsert.length > 0) {
    const { error: insErr } = await db.from('accounting_transactions').insert(toInsert);
    if (insErr) throw new Error(insErr.message);
  }

  revalidatePath('/admin/finance');
  return { postedCount: toInsert.length, skippedCount: workerIds.length - toInsert.length };
}
