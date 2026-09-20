'use client';

import { useState } from 'react';
import { addBusinessFactor, getDemandFactorsReport, syncMissingWeather } from '@/lib/actions/demandFactors';
import type { BusinessFactorEntry, DemandFactorsReportRow } from '@/lib/types';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function WeatherSyncCard() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const result = await syncMissingWeather();
      setMessage(result.message);
    } catch (err: any) {
      setError(err?.message || 'تعذّرت المزامنة');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2><span className="dot" /> مزامنة الطقس</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 0, lineHeight: 1.7 }}>
        يجيب بيانات الطقس (هطول المطر، أعلى حرارة) لإحداثيات كلباء لأي فترة ناقصة من أول عملية بالنظام
        لحد أمس. اضغطه دوري (شهرياً مثلاً) بدل جدولة تلقائية.
      </p>
      <button className="btn-lookup" disabled={loading} onClick={handleSync}>
        {loading ? 'جاري الجلب...' : '🌦️ مزامنة الطقس'}
      </button>
      {message && <div className="save-msg" style={{ display: 'block', marginTop: 8 }}>{message}</div>}
      {error && <div className="lookup-msg show error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function BusinessFactorForm({ onAdded }: { onAdded: (entry: BusinessFactorEntry) => void }) {
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await addBusinessFactor(date, note);
      onAdded({ id: crypto.randomUUID(), factorDate: date, note: note.trim() });
      setNote('');
      setSaved(true);
    } catch (err: any) {
      setError(err?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2><span className="dot" /> إضافة عامل مؤثر</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: '1 1 160px' }} />
        <input
          type="text"
          placeholder="مثال: إغلاق طريق كلباء الرئيسي للصيانة"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ flex: '1 1 260px' }}
        />
        <button className="btn-lookup" disabled={saving} onClick={handleSave}>
          {saving ? '...' : 'حفظ'}
        </button>
      </div>
      {saved && <div className="save-msg" style={{ display: 'block', marginTop: 8 }}>✓ تم الحفظ</div>}
      {error && <div className="lookup-msg show error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function BusinessFactorsList({ factors }: { factors: BusinessFactorEntry[] }) {
  return (
    <div className="card">
      <h2><span className="dot" /> سجل العوامل المؤثرة</h2>
      {factors.length === 0 ? (
        <div className="note">ما فيه عوامل مسجّلة بعد.</div>
      ) : (
        <div className="services">
          {factors.map((f) => (
            <div key={f.id} className="svc-row">
              <span style={{ fontWeight: 700 }}>{f.factorDate}</span>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{f.note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DemandFactorsReportCard() {
  const [from, setFrom] = useState(addDaysStr(todayStr(), -6));
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState<DemandFactorsReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    setLoading(true);
    setError(null);
    try {
      setRows(await getDemandFactorsReport(from, to));
    } catch (err: any) {
      setError(err?.message || 'تعذّر تحميل التقرير');
      setRows(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2><span className="dot" /> التقرير المدمج (إيراد + طقس + عوامل)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span>إلى</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn-lookup" disabled={loading} onClick={handleFetch}>
          {loading ? '...' : 'عرض'}
        </button>
      </div>
      {error && <div className="lookup-msg show error" style={{ marginTop: 8 }}>{error}</div>}
      {rows && (
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'start', borderBottom: '1px solid var(--border, #ddd)' }}>
                <th style={{ padding: '6px 8px' }}>التاريخ</th>
                <th style={{ padding: '6px 8px' }}>الإيراد</th>
                <th style={{ padding: '6px 8px' }}>ممطر؟</th>
                <th style={{ padding: '6px 8px' }}>حر شديد؟</th>
                <th style={{ padding: '6px 8px' }}>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date} style={{ borderBottom: '1px solid var(--border, #eee)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700 }}>{r.date}</td>
                  <td style={{ padding: '6px 8px' }}>{r.revenue}</td>
                  <td style={{ padding: '6px 8px' }}>{r.isRainy === null ? '—' : r.isRainy ? 'نعم' : 'لا'}</td>
                  <td style={{ padding: '6px 8px' }}>
                    {r.isExtremeHeat === null ? '—' : r.isExtremeHeat ? `نعم (${r.tempMaxC}°)` : 'لا'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>{r.notes.length > 0 ? r.notes.join(' — ') : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminDemandFactors({ initialFactors }: { initialFactors: BusinessFactorEntry[] }) {
  const [factors, setFactors] = useState(initialFactors);

  return (
    <>
      <header>
        <div className="brand">
          <div>
            <h1>عوامل مؤثرة على الطلب</h1>
            <div className="en">طقس + أحداث استثنائية</div>
          </div>
        </div>
        <div className="date-line">
          <a href="/admin" className="back-link" style={{ color: '#fff' }}>← الرجوع للإعدادات</a>
        </div>
      </header>

      <main>
        <WeatherSyncCard />
        <BusinessFactorForm onAdded={(entry) => setFactors((prev) => [entry, ...prev])} />
        <BusinessFactorsList factors={factors} />
        <DemandFactorsReportCard />
      </main>
    </>
  );
}
