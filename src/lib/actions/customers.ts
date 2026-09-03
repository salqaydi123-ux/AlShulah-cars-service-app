'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { CustomerAnalytics, DormantCustomer, MonthlyRepeatStat, WeeklyVisitStat } from '@/lib/types';

export interface CustomerExportRow {
  phone: string;
  name: string | null;
  visits: number;
  lastVisitDate: string | null;
}

export async function getCustomerExportRows(): Promise<CustomerExportRow[]> {
  const db = supabaseAdmin();

  const { data: customers, error: custErr } = await db.from('customers').select('id, phone, name');
  if (custErr) throw new Error(custErr.message);

  const { data: transactions, error: txErr } = await db.from('transactions').select('customer_id, tx_date');
  if (txErr) throw new Error(txErr.message);

  const stats = new Map<string, { visits: number; lastVisitDate: string | null }>();
  for (const tx of transactions ?? []) {
    const s = stats.get(tx.customer_id) || { visits: 0, lastVisitDate: null };
    s.visits += 1;
    if (!s.lastVisitDate || tx.tx_date > s.lastVisitDate) s.lastVisitDate = tx.tx_date;
    stats.set(tx.customer_id, s);
  }

  return (customers ?? [])
    .map((c) => {
      const s = stats.get(c.id) || { visits: 0, lastVisitDate: null };
      return { phone: c.phone, name: c.name, visits: s.visits, lastVisitDate: s.lastVisitDate };
    })
    .sort((a, b) => (b.lastVisitDate || '').localeCompare(a.lastVisitDate || ''));
}

// اثنين الأسبوع (ISO week) بتوقيت UTC — تفادياً لأي انزياح بالمنطقة الزمنية عند تجميع تواريخ بصيغة نصية.
function weekStartOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=أحد..6=سبت
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(`${fromDateStr}T00:00:00Z`).getTime();
  const to = new Date(`${toDateStr}T00:00:00Z`).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

const DORMANT_MIN_LIFETIME_VISITS = 3; // "كان يزور بانتظام" — حد أدنى مبسّط لعدد الزيارات الكلي
const DORMANT_GAP_DAYS = 45; // "توقف فترة" — ما مر عليه زيارة من هالعدد أيام
const DORMANT_MIN_DATA_DAYS = 60; // حد أدنى لعمر البيانات قبل ما يصير التصنيف موثوق

export async function getCustomerAnalytics(): Promise<CustomerAnalytics> {
  const db = supabaseAdmin();

  const [customersRes, transactionsRes] = await Promise.all([
    db.from('customers').select('id, phone, name'),
    db.from('transactions').select('customer_id, tx_date').order('tx_date'),
  ]);
  if (customersRes.error) throw new Error(customersRes.error.message);
  if (transactionsRes.error) throw new Error(transactionsRes.error.message);

  const customers = customersRes.data ?? [];
  const transactions = transactionsRes.data ?? [];
  const customerById = new Map(customers.map((c: any) => [c.id, c]));

  if (transactions.length === 0) {
    return { weeklyStats: [], monthlyRepeatStats: [], dormantSectionAvailable: false, daysOfDataSoFar: 0, dormantCustomers: [] };
  }

  // أول زيارة لكل عميل عبر كامل تاريخ النظام — أساس تصنيف "جديد مقابل متكرر" بالأسبوع 2 وما بعده.
  const firstVisitByCustomer = new Map<string, string>();
  for (const tx of transactions) {
    const existing = firstVisitByCustomer.get(tx.customer_id);
    if (!existing || tx.tx_date < existing) firstVisitByCustomer.set(tx.customer_id, tx.tx_date);
  }

  // تجميع أسبوعي: كل الزيارات مجمّعة باثنين أسبوعها، وتصنيف كل زيارة (جديد/متكرر) حسب مقارنة
  // أول زيارة للعميل بمدى الأسبوع (اثنين..أحد).
  const weekMap = new Map<string, { total: number; customers: Set<string>; newCustomers: Set<string>; returningCustomers: Set<string> }>();
  for (const tx of transactions) {
    const wk = weekStartOf(tx.tx_date);
    const bucket = weekMap.get(wk) || { total: 0, customers: new Set<string>(), newCustomers: new Set<string>(), returningCustomers: new Set<string>() };
    bucket.total += 1;
    bucket.customers.add(tx.customer_id);
    weekMap.set(wk, bucket);
  }
  const weekEndOf = (weekStart: string) => {
    const d = new Date(`${weekStart}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  };
  for (const tx of transactions) {
    const wk = weekStartOf(tx.tx_date);
    const wkEnd = weekEndOf(wk);
    const bucket = weekMap.get(wk)!;
    const firstVisit = firstVisitByCustomer.get(tx.customer_id)!;
    if (firstVisit >= wk && firstVisit <= wkEnd) bucket.newCustomers.add(tx.customer_id);
    else bucket.returningCustomers.add(tx.customer_id);
  }

  const weeklyStats: WeeklyVisitStat[] = Array.from(weekMap.entries())
    .map(([weekStart, b]) => ({
      weekStart,
      totalVisits: b.total,
      uniqueCustomers: b.customers.size,
      newCustomers: b.newCustomers.size,
      returningCustomers: b.returningCustomers.size,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // تجميع شهري: متوسط عدد الزيارات لكل عميل نشط بذلك الشهر (زيارات الشهر ÷ عملاء فريدين بالشهر).
  const monthMap = new Map<string, { total: number; customers: Set<string> }>();
  for (const tx of transactions) {
    const month = `${tx.tx_date.slice(0, 7)}-01`;
    const bucket = monthMap.get(month) || { total: 0, customers: new Set<string>() };
    bucket.total += 1;
    bucket.customers.add(tx.customer_id);
    monthMap.set(month, bucket);
  }
  const monthlyRepeatStats: MonthlyRepeatStat[] = Array.from(monthMap.entries())
    .map(([month, b]) => ({
      month,
      totalVisits: b.total,
      uniqueCustomers: b.customers.size,
      avgVisitsPerCustomer: Math.round((b.total / b.customers.size) * 100) / 100,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // القسم الرابع (العملاء المتذبذبين): يحتاج 60 يوم بيانات فعلية على الأقل قبل ما يصير التصنيف
  // موثوق — بدونها ما نقدر نميّز "عميل منتظم توقف" عن "عميل جديد بعده وقت يثبت نمطه".
  const earliestDate = transactions[0].tx_date;
  const todayStr = new Date().toISOString().slice(0, 10);
  const daysOfDataSoFar = daysBetween(earliestDate, todayStr);
  const dormantSectionAvailable = daysOfDataSoFar >= DORMANT_MIN_DATA_DAYS;

  let dormantCustomers: DormantCustomer[] = [];
  if (dormantSectionAvailable) {
    const visitsByCustomer = new Map<string, { count: number; lastVisit: string }>();
    for (const tx of transactions) {
      const s = visitsByCustomer.get(tx.customer_id) || { count: 0, lastVisit: tx.tx_date };
      s.count += 1;
      if (tx.tx_date > s.lastVisit) s.lastVisit = tx.tx_date;
      visitsByCustomer.set(tx.customer_id, s);
    }
    dormantCustomers = Array.from(visitsByCustomer.entries())
      .filter(([, s]) => s.count >= DORMANT_MIN_LIFETIME_VISITS && daysBetween(s.lastVisit, todayStr) >= DORMANT_GAP_DAYS)
      .map(([customerId, s]) => {
        const c: any = customerById.get(customerId);
        return {
          customerId,
          name: c?.name ?? null,
          phone: c?.phone ?? '',
          totalVisits: s.count,
          lastVisitDate: s.lastVisit,
          daysSinceLastVisit: daysBetween(s.lastVisit, todayStr),
        };
      })
      .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);
  }

  return { weeklyStats, monthlyRepeatStats, dormantSectionAvailable, daysOfDataSoFar, dormantCustomers };
}
