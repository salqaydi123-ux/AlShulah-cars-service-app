'use client';

import type { CustomerAnalytics } from '@/lib/types';

function arabicWeekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('ar-AE', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function arabicMonthLabel(month: string): string {
  return new Date(`${month}T00:00:00Z`).toLocaleDateString('ar-AE', { year: 'numeric', month: 'long' });
}

export default function AdminCustomers({ analytics }: { analytics: CustomerAnalytics }) {
  const { weeklyStats, monthlyRepeatStats, dormantSectionAvailable, dormantCustomers, loyalCustomers, newCustomersThisWeek } = analytics;

  return (
    <>
      <header>
        <div className="brand">
          <div>
            <h1>إحصائيات العملاء</h1>
            <div className="en">زيارات، تكرار، وعملاء متذبذبين</div>
          </div>
        </div>
        <div className="date-line">
          <a href="/admin" className="back-link" style={{ color: '#fff' }}>← الرجوع للإعدادات</a>
        </div>
      </header>

      <main>
        <div className="card">
          <h2><span className="dot" /> الزيارات الأسبوعية</h2>
          {weeklyStats.length === 0 ? (
            <div className="note">ما فيه بيانات بعد — تظهر هنا أول عملية تُسجَّل بالتطبيق.</div>
          ) : (
            <div className="services">
              {weeklyStats
                .slice()
                .reverse()
                .map((w) => (
                  <div key={w.weekStart} className="svc-row" style={{ flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700 }}>{arabicWeekLabel(w.weekStart)}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                        {w.totalVisits} زيارة · {w.uniqueCustomers} عميل
                      </span>
                    </div>
                    <div style={{ flex: '1 1 100%', display: 'flex', gap: 12, marginTop: 4, fontSize: 12.5 }}>
                      <span style={{ color: 'var(--success, #2a7)' }}>جدد: {w.newCustomers}</span>
                      <span style={{ color: '#556' }}>عائدون: {w.returningCustomers}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
          <div className="note" style={{ marginTop: 10 }}>
            الأسبوع الأول بعد بدء التسجيل يظهر كل عملائه "جدد" دائماً — هذا طبيعي، ويبدأ التمييز الفعلي بين
            الجدد والعائدين من الأسبوع الثاني.
          </div>
        </div>

        <div className="card">
          <h2><span className="dot" /> عملاء جدد هالأسبوع</h2>
          {newCustomersThisWeek.length === 0 ? (
            <div className="note">ما فيه عملاء جدد هالأسبوع لحد الآن.</div>
          ) : (
            <div className="services">
              {newCustomersThisWeek.map((c) => (
                <div key={c.customerId} className="svc-row">
                  <span style={{ fontWeight: 700 }}>
                    {c.name || c.phone}
                    <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'block', fontWeight: 400 }}>{c.phone}</span>
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--success, #2a7)' }}>أول زيارة: {c.firstVisitDate}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2><span className="dot" /> عملاء منتظمون (نشطون)</h2>
          {loyalCustomers.length === 0 ? (
            <div className="note">ما فيه عملاء وصلوا لحد الانتظام بعد (5 زيارات فأكثر، وآخر زيارة خلال 30 يوم).</div>
          ) : (
            <div className="services">
              {loyalCustomers.map((c) => (
                <div key={c.customerId} className="svc-row">
                  <span style={{ fontWeight: 700 }}>
                    {c.name || c.phone}
                    <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'block', fontWeight: 400 }}>{c.phone}</span>
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{c.totalVisits} زيارة إجمالاً</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2><span className="dot" /> متوسط الزيارات الشهري لكل عميل</h2>
          {monthlyRepeatStats.length === 0 ? (
            <div className="note">ما فيه بيانات بعد.</div>
          ) : (
            <div className="services">
              {monthlyRepeatStats
                .slice()
                .reverse()
                .map((m) => (
                  <div key={m.month} className="svc-row">
                    <span style={{ fontWeight: 700 }}>{arabicMonthLabel(m.month)}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                      {m.totalVisits} زيارة · {m.uniqueCustomers} عميل · متوسط {m.avgVisitsPerCustomer.toFixed(2)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2><span className="dot" /> عملاء متذبذبون (توقفوا عن الزيارة)</h2>
          {!dormantSectionAvailable ? (
            <div className="note">
              البيانات قيد التجميع، يظهر تلقائياً بعد ٦٠ يوم من أول تسجيل فعلي (من ١ سبتمبر 2026 تقريباً نهاية أكتوبر).
            </div>
          ) : dormantCustomers.length === 0 ? (
            <div className="note">ما فيه عملاء متذبذبون حالياً — كل العملاء المنتظمين ما زالوا نشطين.</div>
          ) : (
            <div className="services">
              {dormantCustomers.map((c) => (
                <div key={c.customerId} className="svc-row">
                  <span style={{ fontWeight: 700 }}>
                    {c.name || c.phone}
                    <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'block', fontWeight: 400 }}>{c.phone}</span>
                  </span>
                  <span style={{ fontSize: 12.5, color: '#a33' }}>
                    آخر زيارة قبل {c.daysSinceLastVisit} يوم · {c.totalVisits} زيارة إجمالاً
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
