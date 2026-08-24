'use client';

import { useState } from 'react';
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

function SavedTick({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="save-msg">✓ تم الحفظ</span>;
}

function WashRow({ row, onSaved }: { row: AdminConfigSnapshot['washOptions'][number]; onSaved: () => void }) {
  const [name, setName] = useState(row.name);
  const [sedan, setSedan] = useState(String(row.sedan_price));
  const [fourwd, setFourwd] = useState(String(row.fourwd_price));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await upsertWashOption({
        code: row.code,
        name,
        sedanPrice: parseFloat(sedan) || 0,
        fourwdPrice: parseFloat(fourwd) || 0,
        sortOrder: row.sort_order,
      });
      setSaved(true);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="svc-row" style={{ flexWrap: 'wrap' }}>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: '1 1 100%', marginBottom: 6 }} />
      <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center' }}>
        <label style={{ margin: 0, whiteSpace: 'nowrap' }}>صالون</label>
        <input type="number" className="svc-price" value={sedan} onChange={(e) => setSedan(e.target.value)} />
        <label style={{ margin: 0, whiteSpace: 'nowrap' }}>فورويل</label>
        <input type="number" className="svc-price" value={fourwd} onChange={(e) => setFourwd(e.target.value)} />
        <button className="btn-lookup" disabled={saving} onClick={save}>{saving ? '...' : 'حفظ'}</button>
      </div>
      <SavedTick show={saved} />
    </div>
  );
}

function PriceRow({
  name: initialName,
  price: initialPrice,
  extra,
  onSave,
}: {
  name: string;
  price: string;
  extra?: string;
  onSave: (name: string, price: string, extra?: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState(initialPrice);
  const [extraVal, setExtraVal] = useState(extra ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await onSave(name, price, extra !== undefined ? extraVal : undefined);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="svc-row" style={{ flexWrap: 'wrap' }}>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: '1 1 100%', marginBottom: 6 }} />
      {extra !== undefined && (
        <input type="text" placeholder="ملاحظة إرشادية (اختياري)" value={extraVal} onChange={(e) => setExtraVal(e.target.value)} style={{ flex: '1 1 100%', marginBottom: 6 }} />
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
  const [rate, setRate] = useState(String(row.rate_percent));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await upsertCardRate({ cardType: row.card_type as any, label, ratePercent: parseFloat(rate) || 0 });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="svc-row" style={{ flexWrap: 'wrap' }}>
      <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} style={{ flex: '1 1 100%', marginBottom: 6 }} />
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
          <a href="/" className="back-link" style={{ color: '#fff' }}>← الرجوع لسجل التشغيل</a>
        </div>
      </header>

      <main>
        <div className="note">
          كل تعديل هنا يُحفظ بتاريخه — العمليات السابقة تحتفظ بالسعر/النسبة التي كانت سارية وقت تنفيذها، ولا تتأثر بأي تعديل لاحق.
        </div>

        <div className="card">
          <h2><span className="dot" /> أسعار الغسيل الأساسي</h2>
          <div className="services">
            {config.washOptions.map((w) => <WashRow key={w.id} row={w} onSaved={() => {}} />)}
          </div>
        </div>

        <div className="card">
          <h2><span className="dot" /> إضافات الغسيل (سعر ثابت)</h2>
          <div className="services">
            {config.addonServices.map((a) => (
              <PriceRow
                key={a.id}
                name={a.name}
                price={String(a.price)}
                onSave={async (name, price) => {
                  await upsertAddonService({ code: a.code, name, price: parseFloat(price) || 0, sortOrder: a.sort_order });
                }}
              />
            ))}
          </div>
        </div>

        <div className="card">
          <h2><span className="dot" /> الخدمات اليدوية (بدون سعر ثابت)</h2>
          <div className="services">
            {config.manualServices.map((m) => (
              <PriceRow
                key={m.id}
                name={m.name}
                price=""
                extra={m.hint || ''}
                onSave={async (name, _price, hint) => {
                  await upsertManualService({ code: m.code, name, hint: hint || '', sortOrder: m.sort_order });
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
      </main>
    </>
  );
}
