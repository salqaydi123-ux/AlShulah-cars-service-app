'use client';

import { useEffect, useState } from 'react';
import { getFinancialReport, getPayrollForMonth, submitExpense, submitPayroll } from '@/lib/actions/accounting';
import { listByDate } from '@/lib/actions/transactions';
import {
  ACCOUNT_TYPE_LABEL_BY_LANG,
  COMPENSATION_LABEL_BY_LANG,
  LANG_STORAGE_KEY,
  PAY_METHOD_PLAIN_LABEL_BY_LANG,
  REPORT_PRESET_LABEL_BY_LANG,
  t,
  type Lang,
} from '@/lib/i18n';
import type { ExpenseAccountOption, FinancialReport, PayrollMonthRow, TransactionEntry } from '@/lib/types';

function monthLabel(monthStart: string, lang: Lang): string {
  return new Date(`${monthStart}T00:00:00Z`).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function SavedTick({ show, lang }: { show: boolean; lang: Lang }) {
  if (!show) return null;
  return <span className="save-msg">{t('✓ تم الحفظ', lang)}</span>;
}

function ExpenseForm({ accounts, months, lang }: { accounts: ExpenseAccountOption[]; months: string[]; lang: Lang }) {
  const [accountCode, setAccountCode] = useState(accounts[0]?.account_code || '');
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState(months[0] || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await submitExpense({ accountCode, amount: parseFloat(amount) || 0, month });
      setSaved(true);
      setAmount('');
    } catch (err: any) {
      setError(err?.message || t('تعذّر الحفظ', lang));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2><span className="dot" /> {t('مصاريف شهرية', lang)}</h2>
      <div className="services">
        <div className="svc-row" style={{ flexWrap: 'wrap' }}>
          <select value={accountCode} onChange={(e) => setAccountCode(e.target.value)} style={{ flex: '1 1 100%', marginBottom: 6 }}>
            {accounts.map((a) => (
              <option key={a.account_code} value={a.account_code}>
                {lang === 'en' && a.account_name_en ? a.account_name_en : a.account_name_ar}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder={t('المبلغ', lang)}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ flex: '1 1 100%', marginBottom: 6 }}
          />
          <select value={month} onChange={(e) => setMonth(e.target.value)} style={{ flex: '1 1 100%', marginBottom: 6 }}>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m, lang)}
              </option>
            ))}
          </select>
          <button className="btn-lookup" disabled={saving || !accountCode || !month} onClick={save} style={{ width: '100%' }}>
            {saving ? '...' : t('حفظ المصروف', lang)}
          </button>
        </div>
        <SavedTick show={saved} lang={lang} />
        {error && <div className="lookup-msg show error" style={{ marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  );
}

function PayrollForm({ months, lang }: { months: string[]; lang: Lang }) {
  const [month, setMonth] = useState(months[0] || '');
  const [rows, setRows] = useState<PayrollMonthRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    getPayrollForMonth(month)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setSelected(new Set(data.filter((r) => !r.already_posted && r.amount_due > 0).map((r) => r.worker_id)));
      })
      .catch((err) => !cancelled && setError(err?.message || t('تعذّر التحميل', lang)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [month]);

  function toggle(workerId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  }

  async function confirmAndSave() {
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const res = await submitPayroll(month, Array.from(selected));
      const skippedNote =
        res.skippedCount > 0
          ? lang === 'en'
            ? ` — skipped ${res.skippedCount} (already paid or nothing due)`
            : ` — تجاوز ${res.skippedCount} (مدفوع مسبقاً أو بدون مستحق)`
          : '';
      setResult((lang === 'en' ? `✓ Saved ${res.postedCount} payroll entries` : `✓ تم حفظ ${res.postedCount} راتب`) + skippedNote);
      const data = await getPayrollForMonth(month);
      setRows(data);
      setSelected(new Set(data.filter((r) => !r.already_posted && r.amount_due > 0).map((r) => r.worker_id)));
    } catch (err: any) {
      setError(err?.message || t('تعذّر الحفظ', lang));
    } finally {
      setSaving(false);
    }
  }

  if (months.length === 0) {
    return (
      <div className="card">
        <h2><span className="dot" /> {t('رواتب', lang)}</h2>
        <div className="note">{t('ما فيه شهر منتهي بعد — الشهر يظهر هنا بعد ما يخلص كامل (أرقام الرواتب تبقى غير مكتملة قبل ذلك).', lang)}</div>
      </div>
    );
  }

  const selectableCount = rows.filter((r) => !r.already_posted && r.amount_due > 0).length;

  return (
    <div className="card">
      <h2><span className="dot" /> {t('رواتب', lang)}</h2>
      <div className="services">
        <select value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m, lang)}
            </option>
          ))}
        </select>

        {loading && <div className="note">{t('جاري التحميل...', lang)}</div>}

        {!loading &&
          rows.map((r) => (
            <div key={r.worker_id} className="svc-row" style={{ opacity: r.already_posted ? 0.55 : 1 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: r.already_posted ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ width: 16, height: 16 }}
                  checked={r.already_posted || selected.has(r.worker_id)}
                  disabled={r.already_posted}
                  onChange={() => toggle(r.worker_id)}
                />
                <span>
                  {r.full_name}
                  <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'block' }}>
                    {COMPENSATION_LABEL_BY_LANG[lang][r.compensation_type] || r.compensation_type}
                  </span>
                </span>
              </label>
              <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                {r.already_posted ? t('✓ مدفوع', lang) : `AED ${r.amount_due.toFixed(2)}`}
              </span>
            </div>
          ))}

        {!loading && rows.length > 0 && (
          <button className="btn-lookup" disabled={saving || selectableCount === 0} onClick={confirmAndSave} style={{ width: '100%', marginTop: 10 }}>
            {saving ? '...' : `${t('تأكيد وحفظ', lang)} (${selected.size})`}
          </button>
        )}
        {result && <div className="save-msg" style={{ display: 'block', marginTop: 8 }}>{result}</div>}
        {error && <div className="lookup-msg show error" style={{ marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  );
}

// نفس أسلوب تصدير CSV المستخدم بتصدير العملاء (AdminSettings.tsx) — BOM حتى يفتح صح بإكسل مع النص العربي.
// dayDetails تُضاف فقط لما الفترة يوم واحد (نفس شرط عرضها بالشاشة).
function downloadReportCsv(report: FinancialReport, dayDetails: TransactionEntry[] | null, lang: Lang) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    [t('الفترة', lang), `${lang === 'en' ? 'From' : 'من'} ${report.from} ${lang === 'en' ? 'to' : 'إلى'} ${report.to}`].map(escape).join(','),
    [t('إجمالي الإيرادات', lang), report.totalRevenue.toFixed(2)].map(escape).join(','),
    [t('إجمالي المصاريف', lang), report.totalExpense.toFixed(2)].map(escape).join(','),
    [t('صافي الربح', lang), report.netProfit.toFixed(2)].map(escape).join(','),
    '',
    [t('رقم الحساب', lang), t('اسم الحساب', lang), t('النوع', lang), t('المبلغ', lang)].map(escape).join(','),
  ];
  for (const r of report.rows) {
    const name = lang === 'en' && r.account_name_en ? r.account_name_en : r.account_name_ar;
    lines.push([r.account_code, name, ACCOUNT_TYPE_LABEL_BY_LANG[lang][r.account_type] || r.account_type, r.total.toFixed(2)].map(escape).join(','));
  }

  if (report.from === report.to && dayDetails && dayDetails.length > 0) {
    lines.push('');
    lines.push(
      [t('الوقت', lang), t('اللوحة', lang), t('العميل', lang), t('الخدمات', lang), t('الموظف', lang), t('طريقة الدفع', lang), t('المبلغ', lang)]
        .map(escape)
        .join(',')
    );
    for (const entry of dayDetails) {
      lines.push(
        [
          entry.time,
          entry.plate,
          entry.customerName,
          entry.services.map((s) => (lang === 'en' && s.nameEn ? s.nameEn : s.name)).join(lang === 'en' ? ', ' : '، '),
          entry.employeeName,
          PAY_METHOD_PLAIN_LABEL_BY_LANG[lang][entry.payMethod] || entry.payMethod,
          entry.total.toFixed(2),
        ]
          .map(escape)
          .join(',')
      );
    }
  }

  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alshulah-financial-report-${report.from}-to-${report.to}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function reportDateLabel(dateStr: string, lang: Lang): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

type ReportPreset = 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth';

function presetRange(preset: ReportPreset): { from: string; to: string } {
  const today = new Date();
  if (preset === 'yesterday') {
    const y = addDays(today, -1);
    return { from: fmtDate(y), to: fmtDate(y) };
  }
  if (preset === 'last7') {
    return { from: fmtDate(addDays(today, -6)), to: fmtDate(today) };
  }
  if (preset === 'thisMonth') {
    return { from: fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmtDate(today) };
  }
  // lastMonth
  return {
    from: fmtDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
    to: fmtDate(new Date(today.getFullYear(), today.getMonth(), 0)),
  };
}

function FinancialReportCard({ lang }: { lang: Lang }) {
  const [from, setFrom] = useState(() => presetRange('yesterday').from);
  const [to, setTo] = useState(() => presetRange('yesterday').to);
  const [activePreset, setActivePreset] = useState<ReportPreset | null>('yesterday');
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<TransactionEntry[] | null>(null);
  const [dayDetailsLoading, setDayDetailsLoading] = useState(false);

  // التفاصيل التشغيلية (لوحة/خدمات/مبلغ لكل عملية) تُعرض بس لما الفترة تكون يوم واحد —
  // بيانات "اليومي" (transactions) مو المحاسبية (accounting_transactions) اللي فيها المجاميع فقط.
  function load(range: { from: string; to: string }) {
    setLoading(true);
    setError(null);
    setDayDetails(null);
    getFinancialReport(range)
      .then(setReport)
      .catch((err) => setError(err?.message || t('تعذّر تحميل التقرير', lang)))
      .finally(() => setLoading(false));

    if (range.from === range.to) {
      setDayDetailsLoading(true);
      listByDate(range.from)
        .then(setDayDetails)
        .catch(() => setDayDetails([]))
        .finally(() => setDayDetailsLoading(false));
    }
  }

  useEffect(() => {
    load(presetRange('yesterday'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickPreset(preset: ReportPreset) {
    const range = presetRange(preset);
    setActivePreset(preset);
    setFrom(range.from);
    setTo(range.to);
    load(range);
  }

  function applyCustomRange() {
    setActivePreset(null);
    load({ from, to });
  }

  return (
    <div className="card">
      <h2><span className="dot" /> {t('تقرير مالي', lang)}</h2>
      <div className="services">
        <div className="svc-row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(REPORT_PRESET_LABEL_BY_LANG[lang]) as ReportPreset[]).map((p) => (
            <button
              key={p}
              className="btn-lookup"
              style={{ opacity: activePreset === p ? 1 : 0.55, flex: '1 1 auto' }}
              onClick={() => pickPreset(p)}
            >
              {REPORT_PRESET_LABEL_BY_LANG[lang][p]}
            </button>
          ))}
        </div>

        <div className="svc-row" style={{ flexWrap: 'wrap', marginTop: 10 }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ flex: '1 1 45%' }} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ flex: '1 1 45%' }} />
          <button className="btn-lookup" disabled={loading} onClick={applyCustomRange} style={{ flex: '1 1 100%', marginTop: 6 }}>
            {loading ? '...' : t('عرض الفترة المحددة', lang)}
          </button>
        </div>

        {error && <div className="lookup-msg show error" style={{ marginTop: 8 }}>{error}</div>}

        {report && !loading && (
          <>
            <div className="note" style={{ marginTop: 12 }}>
              {reportDateLabel(report.from, lang)} — {reportDateLabel(report.to, lang)}
            </div>

            <div className="svc-row" style={{ justifyContent: 'space-between' }}>
              <span>{t('إجمالي الإيرادات', lang)}</span>
              <span style={{ fontWeight: 700, color: 'var(--success, #2a7)' }}>AED {report.totalRevenue.toFixed(2)}</span>
            </div>
            <div className="svc-row" style={{ justifyContent: 'space-between' }}>
              <span>{t('إجمالي المصاريف', lang)}</span>
              <span style={{ fontWeight: 700 }}>AED {report.totalExpense.toFixed(2)}</span>
            </div>
            <div className="svc-row" style={{ justifyContent: 'space-between' }}>
              <span>{t('صافي الربح', lang)}</span>
              <span style={{ fontWeight: 700, color: report.netProfit >= 0 ? 'var(--success, #2a7)' : '#a33' }}>
                AED {report.netProfit.toFixed(2)}
              </span>
            </div>

            {report.rows.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {report.rows.map((r) => (
                  <div key={r.account_code} className="svc-row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                    <span>
                      {lang === 'en' && r.account_name_en ? r.account_name_en : r.account_name_ar}
                      <span style={{ color: 'var(--muted)' }}> ({ACCOUNT_TYPE_LABEL_BY_LANG[lang][r.account_type] || r.account_type})</span>
                    </span>
                    <span>AED {r.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {report.rows.length === 0 && <div className="note">{t('ما فيه أي عملية بهذي الفترة.', lang)}</div>}

            {report.from === report.to && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, margin: '8px 0' }}>{t('تفاصيل عمليات اليوم (اللوحة/الخدمات/المبلغ)', lang)}</div>
                {dayDetailsLoading && <div className="note">{t('جاري التحميل...', lang)}</div>}
                {!dayDetailsLoading && dayDetails && dayDetails.length === 0 && (
                  <div className="note">{t('ما فيه عمليات تسجيل يومي بهذا التاريخ.', lang)}</div>
                )}
                {!dayDetailsLoading &&
                  dayDetails?.map((entry) => (
                    <div key={entry.id} className="svc-row" style={{ flexWrap: 'wrap', fontSize: 13 }}>
                      <div style={{ flex: '1 1 100%', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700 }}>{entry.plate}</span>
                        <span style={{ fontWeight: 700 }}>AED {entry.total.toFixed(2)}</span>
                      </div>
                      <div style={{ flex: '1 1 100%', color: 'var(--muted)' }}>
                        {entry.time} — {entry.customerName} — {entry.employeeName} — {PAY_METHOD_PLAIN_LABEL_BY_LANG[lang][entry.payMethod] || entry.payMethod}
                      </div>
                      <div style={{ flex: '1 1 100%', color: 'var(--muted)' }}>
                        {entry.services.map((s) => (lang === 'en' && s.nameEn ? s.nameEn : s.name)).join(lang === 'en' ? ', ' : '، ')}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <button className="btn-lookup" onClick={() => downloadReportCsv(report, dayDetails, lang)} style={{ width: '100%', marginTop: 10 }}>
              {t('⬇️ تحميل Excel (CSV)', lang)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminFinance({
  expenseAccounts,
  expenseMonths,
  payrollMonths,
}: {
  expenseAccounts: ExpenseAccountOption[];
  expenseMonths: string[];
  payrollMonths: string[];
}) {
  // يتبع نفس اختيار اللغة المحفوظ من الصفحة الرئيسية (localStorage) — بدون زر تبديل مستقل هنا،
  // حتى يبقى الاختيار موحّداً عبر التطبيق كله بدل ما يختلف من صفحة لصفحة.
  const [lang, setLang] = useState<Lang>('ar');
  useEffect(() => {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') setLang(saved);
  }, []);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div dir={dir}>
      <header>
        <div className="brand">
          <div>
            <h1>{t('الشؤون المالية', lang)}</h1>
            <div className="en">{t('مصاريف شهرية ورواتب', lang)}</div>
          </div>
        </div>
        <div className="date-line">
          <a href="/admin" className="back-link" style={{ color: '#fff' }}>{t('← الرجوع للإعدادات', lang)}</a>
        </div>
      </header>

      <main>
        <div className="note">
          {t('كل قيد هنا يُسجَّل مباشرة بدفتر المحاسبة (accounting_transactions). فورم الرواتب يمنع تسجيل نفس العامل مرتين لنفس الشهر تلقائياً.', lang)}
        </div>

        <ExpenseForm accounts={expenseAccounts} months={expenseMonths} lang={lang} />
        <PayrollForm months={payrollMonths} lang={lang} />
        <FinancialReportCard lang={lang} />
      </main>
    </div>
  );
}
