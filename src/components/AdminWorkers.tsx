'use client';

import { useState } from 'react';
import { endLeave, getWorkersOverview, startLeave, updateVisa } from '@/lib/actions/workers';
import { COMPENSATION_LABEL_BY_LANG } from '@/lib/i18n';
import type { WorkerOverviewRow } from '@/lib/types';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function LeaveControl({ worker, onChanged }: { worker: WorkerOverviewRow; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      if (worker.on_leave) await endLeave(worker.worker_id, date);
      else await startLeave(worker.worker_id, date);
      setOpen(false);
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-lookup" onClick={() => setOpen(true)}>
        {worker.on_leave ? 'تسجيل عودة' : 'تسجيل إجازة'}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <button className="btn-lookup" disabled={saving} onClick={confirm}>
        {saving ? '...' : 'تأكيد'}
      </button>
      <button className="btn-lookup" style={{ opacity: 0.6 }} onClick={() => setOpen(false)} disabled={saving}>
        إلغاء
      </button>
      {error && <div className="lookup-msg show error" style={{ width: '100%' }}>{error}</div>}
    </div>
  );
}

function VisaControl({ worker, onChanged }: { worker: WorkerOverviewRow; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [issueDate, setIssueDate] = useState(worker.visa_issue_date || '');
  const [expiryDate, setExpiryDate] = useState(worker.visa_expiry_date || '');
  const [cost, setCost] = useState(worker.visa_last_cost !== null ? String(worker.visa_last_cost) : '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateVisa(worker.worker_id, {
        visaIssueDate: issueDate || null,
        visaExpiryDate: expiryDate || null,
        visaLastCost: cost ? parseFloat(cost) : null,
      });
      setSaved(true);
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-lookup" style={{ opacity: 0.7 }} onClick={() => setOpen(true)}>
        بيانات التأشيرة
      </button>
    );
  }

  return (
    <div style={{ width: '100%', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      <label style={{ flex: '1 1 100%', fontSize: 12, color: 'var(--muted)' }}>تاريخ الإصدار</label>
      <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} style={{ flex: '1 1 100%' }} />
      <label style={{ flex: '1 1 100%', fontSize: 12, color: 'var(--muted)' }}>تاريخ الانتهاء</label>
      <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={{ flex: '1 1 100%' }} />
      <label style={{ flex: '1 1 100%', fontSize: 12, color: 'var(--muted)' }}>آخر تكلفة تجديد (د.إ)</label>
      <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} style={{ flex: '1 1 100%' }} />
      <div style={{ display: 'flex', gap: 6, width: '100%' }}>
        <button className="btn-lookup" disabled={saving} onClick={save}>
          {saving ? '...' : 'حفظ'}
        </button>
        <button className="btn-lookup" style={{ opacity: 0.6 }} onClick={() => setOpen(false)} disabled={saving}>
          إغلاق
        </button>
      </div>
      {saved && <span className="save-msg">✓ تم الحفظ</span>}
      {error && <div className="lookup-msg show error" style={{ width: '100%' }}>{error}</div>}
    </div>
  );
}

function WorkerRow({ worker, onChanged }: { worker: WorkerOverviewRow; onChanged: () => void }) {
  return (
    <div className="svc-row" style={{ flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700 }}>
          {worker.full_name}
          <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'block', fontWeight: 400 }}>
            {COMPENSATION_LABEL_BY_LANG.ar[worker.compensation_type] || worker.compensation_type}
          </span>
        </span>
        <span style={{ fontSize: 12.5, color: worker.on_leave ? '#a33' : 'var(--success, #2a7)' }}>
          {worker.on_leave ? `بإجازة من ${worker.leave_start}` : 'نشط'}
        </span>
      </div>
      <div style={{ flex: '1 1 100%', display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        <LeaveControl worker={worker} onChanged={onChanged} />
        <VisaControl worker={worker} onChanged={onChanged} />
      </div>
    </div>
  );
}

export default function AdminWorkers({ workers: initialWorkers }: { workers: WorkerOverviewRow[] }) {
  const [workers, setWorkers] = useState(initialWorkers);

  async function refresh() {
    try {
      setWorkers(await getWorkersOverview());
    } catch {
      /* تجاهل — تبقى القائمة الحالية بالشاشة لو تعذّر التحديث */
    }
  }

  return (
    <>
      <header>
        <div className="brand">
          <div>
            <h1>العمال</h1>
            <div className="en">إجازات وتجديد تأشيرات</div>
          </div>
        </div>
        <div className="date-line">
          <a href="/admin" className="back-link" style={{ color: '#fff' }}>← الرجوع للإعدادات</a>
        </div>
      </header>

      <main>
        <div className="note">
          تسجيل إجازة/عودة يؤثر مباشرة على حساب الراتب بفورم الرواتب (/admin/finance) — أيام الحضور تُحسب تلقائياً من هذي التواريخ.
          تسجيل العودة يحدّث أيضاً تاريخ استحقاق التذكرة السنوية تلقائياً.
        </div>

        <div className="card">
          <h2><span className="dot" /> قائمة العمال النشطين</h2>
          <div className="services">
            {workers.map((w) => (
              <WorkerRow key={w.worker_id} worker={w} onChanged={refresh} />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
