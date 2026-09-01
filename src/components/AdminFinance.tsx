'use client';

import { useEffect, useState } from 'react';
import { getPayrollForMonth, submitExpense, submitPayroll } from '@/lib/actions/accounting';
import type { ExpenseAccountOption, PayrollMonthRow } from '@/lib/types';

function arabicMonthLabel(monthStart: string): string {
  return new Date(`${monthStart}T00:00:00Z`).toLocaleDateString('ar-AE', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

const COMPENSATION_LABELS: Record<string, string> = {
  fixed: 'راتب ثابت',
  revenue_share: 'نسبة من الدخل',
  fixed_plus_profit_share: 'ثابت + نسبة أرباح',
};

function SavedTick({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="save-msg">✓ تم الحفظ</span>;
}

function ExpenseForm({ accounts, months }: { accounts: ExpenseAccountOption[]; months: string[] }) {
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
      setError(err?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2><span className="dot" /> مصاريف شهرية</h2>
      <div className="services">
        <div className="svc-row" style={{ flexWrap: 'wrap' }}>
          <select value={accountCode} onChange={(e) => setAccountCode(e.target.value)} style={{ flex: '1 1 100%', marginBottom: 6 }}>
            {accounts.map((a) => (
              <option key={a.account_code} value={a.account_code}>
                {a.account_name_ar}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="المبلغ"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ flex: '1 1 100%', marginBottom: 6 }}
          />
          <select value={month} onChange={(e) => setMonth(e.target.value)} style={{ flex: '1 1 100%', marginBottom: 6 }}>
            {months.map((m) => (
              <option key={m} value={m}>
                {arabicMonthLabel(m)}
              </option>
            ))}
          </select>
          <button className="btn-lookup" disabled={saving || !accountCode || !month} onClick={save} style={{ width: '100%' }}>
            {saving ? '...' : 'حفظ المصروف'}
          </button>
        </div>
        <SavedTick show={saved} />
        {error && <div className="lookup-msg show error" style={{ marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  );
}

function PayrollForm({ months }: { months: string[] }) {
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
      .catch((err) => !cancelled && setError(err?.message || 'تعذّر التحميل'))
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
      setResult(`✓ تم حفظ ${res.postedCount} راتب${res.skippedCount > 0 ? ` — تجاوز ${res.skippedCount} (مدفوع مسبقاً أو بدون مستحق)` : ''}`);
      const data = await getPayrollForMonth(month);
      setRows(data);
      setSelected(new Set(data.filter((r) => !r.already_posted && r.amount_due > 0).map((r) => r.worker_id)));
    } catch (err: any) {
      setError(err?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  }

  if (months.length === 0) {
    return (
      <div className="card">
        <h2><span className="dot" /> رواتب</h2>
        <div className="note">ما فيه شهر منتهي بعد — الشهر يظهر هنا بعد ما يخلص كامل (أرقام الرواتب تبقى غير مكتملة قبل ذلك).</div>
      </div>
    );
  }

  const selectableCount = rows.filter((r) => !r.already_posted && r.amount_due > 0).length;

  return (
    <div className="card">
      <h2><span className="dot" /> رواتب</h2>
      <div className="services">
        <select value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
          {months.map((m) => (
            <option key={m} value={m}>
              {arabicMonthLabel(m)}
            </option>
          ))}
        </select>

        {loading && <div className="note">جاري التحميل...</div>}

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
                  <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'block' }}>{COMPENSATION_LABELS[r.compensation_type] || r.compensation_type}</span>
                </span>
              </label>
              <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                {r.already_posted ? '✓ مدفوع' : `AED ${r.amount_due.toFixed(2)}`}
              </span>
            </div>
          ))}

        {!loading && rows.length > 0 && (
          <button className="btn-lookup" disabled={saving || selectableCount === 0} onClick={confirmAndSave} style={{ width: '100%', marginTop: 10 }}>
            {saving ? '...' : `تأكيد وحفظ (${selected.size})`}
          </button>
        )}
        {result && <div className="save-msg" style={{ display: 'block', marginTop: 8 }}>{result}</div>}
        {error && <div className="lookup-msg show error" style={{ marginTop: 8 }}>{error}</div>}
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
  return (
    <>
      <header>
        <div className="brand">
          <div>
            <h1>الشؤون المالية</h1>
            <div className="en">مصاريف شهرية ورواتب</div>
          </div>
        </div>
        <div className="date-line">
          <a href="/admin" className="back-link" style={{ color: '#fff' }}>← الرجوع للإعدادات</a>
        </div>
      </header>

      <main>
        <div className="note">
          كل قيد هنا يُسجَّل مباشرة بدفتر المحاسبة (accounting_transactions). فورم الرواتب يمنع تسجيل نفس العامل مرتين لنفس الشهر تلقائياً.
        </div>

        <ExpenseForm accounts={expenseAccounts} months={expenseMonths} />
        <PayrollForm months={payrollMonths} />
      </main>
    </>
  );
}
