'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { BusinessFactorEntry, DemandFactorsReportRow, WeatherSyncResult } from '@/lib/types';

// إحداثيات كلباء، الشارقة.
const KALBA_LAT = 25.0333;
const KALBA_LON = 56.35;
const EXTREME_HEAT_THRESHOLD_C = 40;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

// نجيب الطقس بس للفترة اللي فيها إيراد فعلي مسجَّل — من أول عملية بالنظام لحد أمس (الطقس
// المستقبلي/اليوم الحالي غير مكتمل بعد بمزوّد الخدمة).
async function findMissingWeatherRanges(db: ReturnType<typeof supabaseAdmin>): Promise<{ from: string; to: string }[]> {
  const yesterday = addDays(isoDate(new Date()), -1);

  const { data: earliestTx, error: txErr } = await db
    .from('accounting_transactions')
    .select('transaction_date')
    .order('transaction_date', { ascending: true })
    .limit(1);
  if (txErr) throw new Error(txErr.message);
  if (!earliestTx || earliestTx.length === 0) return [];

  const earliestDate = earliestTx[0].transaction_date as string;
  if (earliestDate > yesterday) return [];

  const { data: existing, error: wErr } = await db
    .from('weather_daily')
    .select('date')
    .gte('date', earliestDate)
    .lte('date', yesterday)
    .order('date');
  if (wErr) throw new Error(wErr.message);
  const existingDates = new Set((existing ?? []).map((r: any) => r.date as string));

  const ranges: { from: string; to: string }[] = [];
  let rangeStart: string | null = null;
  let cursor = earliestDate;
  while (cursor <= yesterday) {
    if (!existingDates.has(cursor)) {
      if (!rangeStart) rangeStart = cursor;
    } else if (rangeStart) {
      ranges.push({ from: rangeStart, to: addDays(cursor, -1) });
      rangeStart = null;
    }
    cursor = addDays(cursor, 1);
  }
  if (rangeStart) ranges.push({ from: rangeStart, to: yesterday });
  return ranges;
}

interface VisualCrossingDay {
  datetime: string;
  precip: number | null;
  tempmax: number | null;
}

async function fetchWeatherRange(apiKey: string, from: string, to: string): Promise<VisualCrossingDay[]> {
  const url =
    `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/` +
    `${KALBA_LAT},${KALBA_LON}/${from}/${to}` +
    `?unitGroup=metric&include=days&elements=datetime,precip,tempmax&contentType=json&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Visual Crossing API: ${res.status} — ${await res.text()}`);
  const data = await res.json();
  return (data.days ?? []) as VisualCrossingDay[];
}

function toWeatherRow(day: VisualCrossingDay) {
  const precip = day.precip ?? 0;
  const tempMax = day.tempmax ?? null;
  return {
    date: day.datetime,
    precipitation_mm: precip,
    is_rainy: precip > 0,
    temp_max_c: tempMax,
    is_extreme_heat: tempMax !== null && tempMax > EXTREME_HEAT_THRESHOLD_C,
  };
}

// زر "مزامنة الطقس" بصفحة /admin — يكتشف الفترات الناقصة تلقائياً ويجيبها دفعة وحدة لكل فجوة
// (طلب واحد لكل فترة متصلة، مو طلب لكل يوم) لتوفير حصة الـAPI المجانية (1000 سجل/يوم).
export async function syncMissingWeather(): Promise<WeatherSyncResult> {
  const apiKey = process.env.VISUAL_CROSSING_API_KEY;
  if (!apiKey) {
    throw new Error('مفتاح Visual Crossing API غير مُعد — أضفه كمتغير بيئة VISUAL_CROSSING_API_KEY بإعدادات Vercel');
  }

  const db = supabaseAdmin();
  const ranges = await findMissingWeatherRanges(db);
  if (ranges.length === 0) {
    return { daysFetched: 0, message: 'كل بيانات الطقس محدّثة — ما فيه فترات ناقصة.' };
  }

  let daysFetched = 0;
  for (const range of ranges) {
    const days = await fetchWeatherRange(apiKey, range.from, range.to);
    const rows = days.map(toWeatherRow);
    if (rows.length === 0) continue;
    const { error } = await db.from('weather_daily').upsert(rows, { onConflict: 'date' });
    if (error) throw new Error(error.message);
    daysFetched += rows.length;
  }

  revalidatePath('/admin/demand-factors');
  return { daysFetched, message: `تم جلب بيانات الطقس لـ${daysFetched} يوم.` };
}

export async function addBusinessFactor(factorDate: string, note: string): Promise<void> {
  if (!factorDate) throw new Error('حدد التاريخ');
  if (!note.trim()) throw new Error('اكتب وصف الحدث');

  const db = supabaseAdmin();
  const { error } = await db.from('business_factors_log').insert({ factor_date: factorDate, note: note.trim() });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/demand-factors');
}

export async function getBusinessFactors(): Promise<BusinessFactorEntry[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('business_factors_log')
    .select('id, factor_date, note')
    .order('factor_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ id: r.id, factorDate: r.factor_date, note: r.note }));
}

export async function getDemandFactorsReport(from: string, to: string): Promise<DemandFactorsReportRow[]> {
  if (!from || !to) throw new Error('حدد الفترة');
  if (from > to) throw new Error('تاريخ البداية بعد تاريخ النهاية');

  const db = supabaseAdmin();
  const [txRes, weatherRes, factorsRes] = await Promise.all([
    db
      .from('accounting_transactions')
      .select('transaction_date, amount, chart_of_accounts(account_type)')
      .gte('transaction_date', from)
      .lte('transaction_date', to),
    db.from('weather_daily').select('date, is_rainy, temp_max_c, is_extreme_heat').gte('date', from).lte('date', to),
    db.from('business_factors_log').select('factor_date, note').gte('factor_date', from).lte('factor_date', to),
  ]);
  if (txRes.error) throw new Error(txRes.error.message);
  if (weatherRes.error) throw new Error(weatherRes.error.message);
  if (factorsRes.error) throw new Error(factorsRes.error.message);

  const revenueByDate = new Map<string, number>();
  for (const r of (txRes.data ?? []) as any[]) {
    if (r.chart_of_accounts?.account_type !== 'revenue') continue;
    revenueByDate.set(r.transaction_date, (revenueByDate.get(r.transaction_date) ?? 0) + Number(r.amount));
  }

  const weatherByDate = new Map<string, any>((weatherRes.data ?? []).map((w: any) => [w.date, w]));

  const notesByDate = new Map<string, string[]>();
  for (const f of (factorsRes.data ?? []) as any[]) {
    const list = notesByDate.get(f.factor_date) ?? [];
    list.push(f.note);
    notesByDate.set(f.factor_date, list);
  }

  const rows: DemandFactorsReportRow[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const w = weatherByDate.get(d);
    rows.push({
      date: d,
      revenue: Math.round((revenueByDate.get(d) ?? 0) * 100) / 100,
      isRainy: w ? w.is_rainy : null,
      tempMaxC: w && w.temp_max_c !== null ? Number(w.temp_max_c) : null,
      isExtremeHeat: w ? w.is_extreme_heat : null,
      notes: notesByDate.get(d) ?? [],
    });
  }
  return rows;
}
