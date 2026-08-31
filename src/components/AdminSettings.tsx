'use client';

import { useState } from 'react';
import { getCustomerExportRows, type CustomerExportRow } from '@/lib/actions/customers';
import {
  addEmployee,
  renameEmployee,
  setEmployeeActive,
  upsertAddonService,
  upsertCardRate,
  upsertManualService,
  upsertWashOption,
  type AdminConfigSnapshot,
} from '@/lib/actions/settings';

function downloadCustomersCsv(rows: CustomerExportRow[]) {
  const header = ['الاسم', 'رقم الجوال', 'عدد الزيارات', 'آخر زيارة'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [header.map(escape).join(',')];
  for (const r of rows) {
    lines.push([r.name || '', r.phone, String(r.visits), r.lastVisitDate || ''].map(escape).join(','));
  }
  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alshulah-customers-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function CustomerExportCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const rows = await getCustomerExportRows();
      downloadCustomersCsv(rows);
      setLastCount(rows.length);
    } catch (err: any) {
      setError(err?.message || 'تعذّر تجهيز الملف');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2><span className="dot" /> تصدير أرقام العملاء</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 0, lineHeight: 1.7 }}>
        يحمّل ملف Excel (CSV) فيه رقم جوال واسم كل عميل، مع عدد زياراته وتاريخ آخر زيارة — يفيدك بإرسال عروض أو تهنئات بمناسبات عبر واتساب.
      </p>
      <button className="btn-lookup" disabled={loading} onClick={handleExport}>
        {loading ? 'جاري التجهيز...' : '⬇️ تحميل CSV'}
      </button>
      {lastCount !== null && <div className="save-msg" style={{ display: 'block', marginTop: 8 }}>✓ تم تحميل {lastCount} عميل</div>}
      {error && <div className="lookup-msg show error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function SavedTick({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="save-msg">✓ تم الحفظ</span>;
}

function WashRow({ row }: { row: AdminConfigSnapshot['washOptions'][number] }) {
  const [name, setName] = useState(row.name);
  const [nameEn, setNameEn] = useState(row.name_en || '');
  const [sedan, setSedan] = useState(String(row.sedan_price));
  const [fourwd, setFourwd] = useState(String(row.fourwd_price));
  const [isManualPrice, setIsManualPrice] = useState(row.is_manual_price);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await upsertWashOption({
        code: row.code,
        name,
        nameEn,
        sedanPrice: parseFloat(sedan) || 0,
        fourwdPrice: parseFloat(fourwd) || 0,
        isManualPrice,
        sortOrder: row.sort_order,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="svc-row" style={{ flexWrap: 'wrap' }}>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: '1 1 100%', marginBottom: 6 }} />
      <input
        type="text"
        dir="ltr"
        placeholder="English name"
        value={nameEn}
        onChange={(e) => setNameEn(e.target.value)}
        style={{ flex: '1 1 100%', marginBottom: 6 }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px', cursor: 'pointer', flex: '1 1 100%' }}>
        <input type="checkbox" style={{ width: 16, height: 16 }} checked={isManualPrice} onChange={(e) => setIsManualPrice(e.target.checked)} />
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>سعر يدوي (يُدخل بكل عملية) بدل السعر الثابت أدناه</span>
      </label>
      <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center', opacity: isManualPrice ? 0.5 : 1 }}>
        <label style={{ margin: 0, whiteSpace: 'nowrap' }}>صالون</label>
        <input type="number" className="svc-price" value={sedan} disabled={isManualPrice} onChange={(e) => setSedan(e.target.value)} />
        <label style={{ margin: 0, whiteSpace: 'nowrap' }}>فورويل</label>
        <input type="number" className="svc-price" value={fourwd} disabled={isManualPrice} onChange={(e) => setFourwd(e.target.value)} />
        <button className="btn-lookup" disabled={saving} onClick={save} style={{ opacity: 1 }}>{saving ? '...' : 'حفظ'}</button>
      </div>
      <SavedTick show={saved} />
    </div>
  );
}

function AddonRow({ row }: { row: AdminConfigSnapshot['addonServices'][number] }) {
  const [name, setName] = useState(row.name);
  const [nameEn, setNameEn] = useState(row.name_en || '');
  const [price, setPrice] = useState(String(row.price));
  const [isManualPrice, setIsManualPrice] = useState(row.is_manual_price);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await upsertAddonService({
        code: row.code,
        name,
        nameEn,
        price: parseFloat(price) || 0,
        isManualPrice,
        sortOrder: row.sort_order,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="svc-row" style={{ flexWrap: 'wrap' }}>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: '1 1 100%', marginBottom: 6 }} />
      <input
        type="text"
        dir="ltr"
        placeholder="English name"
        value={nameEn}
        onChange={(e) => setNameEn(e.target.value)}
        style={{ flex: '1 1 100%', marginBottom: 6 }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px', cursor: 'pointer', flex: '1 1 100%' }}>
        <input type="checkbox" style={{ width: 16, height: 16 }} checked={isManualPrice} onChange={(e) => setIsManualPrice(e.target.checked)} />
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>سعر يدوي (يُدخل بكل عملية) بدل السعر الثابت أدناه</span>
      </label>
      <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center', opacity: isManualPrice ? 0.5 : 1 }}>
        <label style={{ margin: 0, whiteSpace: 'nowrap' }}>السعر</label>
        <input type="number" className="svc-price" value={price} disabled={isManualPrice} onChange={(e) => setPrice(e.target.value)} />
        <button className="btn-lookup" disabled={saving} onClick={save} style={{ opacity: 1 }}>{saving ? '...' : 'حفظ'}</button>
      </div>
      <SavedTick show={saved} />
    </div>
  );
}

function PriceRow({
  name: initialName,
  nameEn: initialNameEn,
  price: initialPrice,
  extra,
  extraEn,
  onSave,
}: {
  name: string;
  nameEn: string;
  price: string;
  extra?: string;
  extraEn?: string;
  onSave: (name: string, nameEn: string, price: string, extra?: string, extraEn?: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [nameEn, setNameEn] = useState(initialNameEn);
  const [price, setPrice] = useState(initialPrice);
  const [extraVal, setExtraVal] = useState(extra ?? '');
  const [extraEnVal, setExtraEnVal] = useState(extraEn ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await onSave(name, nameEn, price, extra !== undefined ? extraVal : undefined, extraEn !== undefined ? extraEnVal : undefined);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="svc-row" style={{ flexWrap: 'wrap' }}>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: '1 1 100%', marginBottom: 6 }} />
      <input
        type="text"
        dir="ltr"
        placeholder="English name"
        value={nameEn}
        onChange={(e) => setNameEn(e.target.value)}
        style={{ flex: '1 1 100%', marginBottom: 6 }}
      />
      {extra !== undefined && (
        <input type="text" placeholder="ملاحظة إرشادية (اختياري)" value={extraVal} onChange={(e) => setExtraVal(e.target.value)} style={{ flex: '1 1 100%', marginBottom: 6 }} />
      )}
      {extraEn !== undefined && (
        <input
          type="text"
          dir="ltr"
          placeholder="Guideline note (English, optional)"
          value={extraEnVal}
          onChange={(e) => setExtraEnVal(e.target.value)}
          style={{ flex: '1 1 100%', marginBottom: 6 }}
        />
      )}
      <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center' }}>
        {price !== '' && (
          <>
            <label style={{ margin: 0, whiteSpace: 'nowrap' }}>السعر</label>
            <input type="number" className="svc-price" value={price} onChange={(e) => setPrice(e.target.value)} />
          </>
        )}
        <button className="btn-lookup" disabled={saving} onClick={save}>{saving ? '...' : 'حفظ'}</button>
      </div>
      <SavedTick show={saved} />
    </div>
  );
}

function CardRateRow({ row }: { row: AdminConfigSnapshot['cardRates'][number] }) {
  const [label, setLabel] = useState(row.label);
  const [labelEn, setLabelEn] = useState(row.label_en || '');
  const [rate, setRate] = useState(String(row.rate_percent));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await upsertCardRate({ cardType: row.card_type as any, label, labelEn, ratePercent: parseFloat(rate) || 0 });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="svc-row" style={{ flexWrap: 'wrap' }}>
      <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} style={{ flex: '1 1 100%', marginBottom: 6 }} />
      <input
        type="text"
        dir="ltr"
        placeholder="English label"
        value={labelEn}
        onChange={(e) => setLabelEn(e.target.value)}
        style={{ flex: '1 1 100%', marginBottom: 6 }}
      />
      <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center' }}>
        <label style={{ margin: 0, whiteSpace: 'nowrap' }}>النسبة %</label>
        <input type="number" step="0.1" className="svc-price" value={rate} onChange={(e) => setRate(e.target.value)} />
        <button className="btn-lookup" disabled={saving} onClick={save}>{saving ? '...' : 'حفظ'}</button>
      </div>
      <SavedTick show={saved} />
    </div>
  );
}

function EmployeeRow({ row, onToggleActive }: { row: AdminConfigSnapshot['employees'][number]; onToggleActive: (id: string, active: boolean) => void }) {
  const [name, setName] = useState(row.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await renameEmployee(row.id, name);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const next = !row.active;
    onToggleActive(row.id, next);
    await setEmployeeActive(row.id, next);
  }

  return (
    <div className="svc-row">
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
      <button className="btn-lookup" disabled={saving} onClick={save}>{saving ? '...' : 'حفظ'}</button>
      <button className="btn-lookup" style={{ background: row.active ? '#a33' : 'var(--success)' }} onClick={toggleActive}>
        {row.active ? 'إيقاف' : 'تفعيل'}
      </button>
      <SavedTick show={saved} />
    </div>
  );
}

export default function AdminSettings({ config }: { config: AdminConfigSnapshot }) {
  const [employees, setEmployees] = useState(config.employees);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [addingEmployee, setAddingEmployee] = useState(false);

  function handleToggleActive(id: string, active: boolean) {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, active } : e)));
  }

  async function handleAddEmployee() {
    if (!newEmployeeName.trim()) return;
    setAddingEmployee(true);
    try {
      await addEmployee(newEmployeeName.trim());
      setEmployees((prev) => [...prev, { id: crypto.randomUUID(), name: newEmployeeName.trim(), active: true, sort_order: prev.length + 1 }]);
      setNewEmployeeName('');
    } finally {
      setAddingEmployee(false);
    }
  }

  return (
    <>
      <header>
        <div className="brand">
          <div>
            <h1>الإعدادات</h1>
            <div className="en">إدارة الأسعار والنسب والموظفين</div>
          </div>
        </div>
        <div className="date-line">
          <a href="/admin/finance" className="back-link" style={{ color: '#fff', marginInlineEnd: 12 }}>الشؤون المالية →</a>
          <a href="/" className="back-link" style={{ color: '#fff' }}>← الرجوع لسجل التشغيل</a>
        </div>
      </header>

      <main>
        <div className="note">
          كل تعديل هنا يُحفظ بتاريخه — العمليات السابقة تحتفظ بالسعر/النسبة التي كانت سارية وقت تنفيذها، ولا تتأثر بأي تعديل لاحق.
          <br />
          أدخل الاسم الإنجليزي (اختياري) لكل خدمة حتى يشوفها العمال الذين لا يقرؤون العربية بلغتهم عند تفعيل وضع English بالصفحة الرئيسية.
        </div>

        <div className="card">
          <h2><span className="dot" /> أسعار الغسيل الأساسي</h2>
          <div className="services">
            {config.washOptions.map((w) => <WashRow key={w.id} row={w} />)}
          </div>
        </div>

        <div className="card">
          <h2><span className="dot" /> إضافات الغسيل</h2>
          <div className="services">
            {config.addonServices.map((a) => <AddonRow key={a.id} row={a} />)}
          </div>
        </div>

        <div className="card">
          <h2><span className="dot" /> الخدمات اليدوية (بدون سعر ثابت)</h2>
          <div className="services">
            {config.manualServices.map((m) => (
              <PriceRow
                key={m.id}
                name={m.name}
                nameEn={m.name_en || ''}
                price=""
                extra={m.hint || ''}
                extraEn={m.hint_en || ''}
                onSave={async (name, nameEn, _price, hint, hintEn) => {
                  await upsertManualService({ code: m.code, name, nameEn, hint: hint || '', hintEn: hintEn || '', sortOrder: m.sort_order });
                }}
              />
            ))}
          </div>
        </div>

        <div className="card">
          <h2><span className="dot" /> نسب عمولة البنك حسب نوع البطاقة</h2>
          <div className="services">
            {config.cardRates.map((r) => <CardRateRow key={r.id} row={r} />)}
          </div>
        </div>

        <div className="card">
          <h2><span className="dot" /> الموظفون</h2>
          <div className="services">
            {employees.map((e) => <EmployeeRow key={e.id} row={e} onToggleActive={handleToggleActive} />)}
          </div>
          <div className="phone-row" style={{ marginTop: 12 }}>
            <input type="text" placeholder="اسم موظف جديد" value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} />
            <button className="btn-lookup" disabled={addingEmployee} onClick={handleAddEmployee}>إضافة</button>
          </div>
        </div>

        <CustomerExportCard />
      </main>
    </>
  );
}
