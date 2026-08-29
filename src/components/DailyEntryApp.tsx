'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { logoutAction } from '@/lib/actions/auth';
import { searchByPhone, searchByPlate } from '@/lib/actions/lookup';
import {
  collectPayment,
  deleteTransaction,
  getReconciliationForDate,
  getTransactionDetail,
  reconcileBankForDate,
  searchStatement,
  searchStatementByPlate,
  submitTransaction,
  updateTransaction,
} from '@/lib/actions/transactions';
import { EMIRATES } from '@/lib/constants';
import {
  BODY_LABEL_BY_LANG,
  PAY_METHOD_LABEL_BY_LANG,
  PAY_STATUS_LABEL_BY_LANG,
  emirateLabel,
  t,
  type Lang,
} from '@/lib/i18n';
import type {
  BankReconciliationResult,
  BodyType,
  CardType,
  FormConfig,
  PayMethod,
  PayStatus,
  TodaySummary,
  TransactionEntry,
  VehicleRecord,
} from '@/lib/types';

const LANG_STORAGE_KEY = 'alshulah_lang';

function fmtDate(lang: Lang): string {
  return new Date().toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function buildSummary(entries: TransactionEntry[]): TodaySummary {
  const cash = entries.filter((e) => e.payStatus === 'paid' && e.payMethod === 'نقدي').reduce((s, e) => s + e.total, 0);
  const cardEntries = entries.filter((e) => e.payStatus === 'paid' && e.payMethod === 'بطاقة');
  const cardGross = cardEntries.reduce((s, e) => s + e.total, 0);
  const cardCommission = cardEntries.reduce((s, e) => s + e.commissionAmount, 0);
  const cardNet = cardEntries.reduce((s, e) => s + e.netAmount, 0);
  const collectedLater = entries.filter((e) => e.payStatus === 'paid' && e.payMethod === 'محصّل لاحقاً').reduce((s, e) => s + e.total, 0);
  const collected = cash + cardNet + collectedLater;
  const pending = entries.filter((e) => e.payStatus === 'pending').reduce((s, e) => s + e.total, 0);
  const grand = cash + cardGross + collectedLater + pending;
  return { cash, cardGross, cardNet, cardCommission, collectedLater, collected, pending, grand };
}

function catalogLabel(s: { name: string; name_en: string | null }, lang: Lang): string {
  return lang === 'en' && s.name_en ? s.name_en : s.name;
}

function joinServices(services: { name: string; nameEn: string | null }[], lang: Lang): string {
  return services.map((s) => (lang === 'en' && s.nameEn ? s.nameEn : s.name)).join(lang === 'en' ? ', ' : '، ');
}

const emptyManualPrices: Record<string, number> = {};

export default function DailyEntryApp({
  config,
  initialEntries,
  initialSummary,
  initialReconciliation,
  todayDate,
}: {
  config: FormConfig;
  initialEntries: TransactionEntry[];
  initialSummary: TodaySummary;
  initialReconciliation: BankReconciliationResult | null;
  todayDate: string;
}) {
  const [lang, setLang] = useState<Lang>('ar');
  const tr = (s: string) => t(s, lang);

  useEffect(() => {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') setLang(saved);
  }, []);

  function toggleLang() {
    const next: Lang = lang === 'ar' ? 'en' : 'ar';
    setLang(next);
    window.localStorage.setItem(LANG_STORAGE_KEY, next);
  }

  const [entries, setEntries] = useState<TransactionEntry[]>(initialEntries);
  const [, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);

  // بحث سريع
  const [searchMode, setSearchMode] = useState<'phone' | 'plate'>('phone');
  const [quickSearchInput, setQuickSearchInput] = useState('');
  const [qsEmirate, setQsEmirate] = useState<string>(EMIRATES[0]);
  const [qsCode, setQsCode] = useState('');
  const [qsNumber, setQsNumber] = useState('');
  const [qsCountry, setQsCountry] = useState('');
  const [lookupMsg, setLookupMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [vehicleChoices, setVehicleChoices] = useState<VehicleRecord[]>([]);

  // بيانات العميل والسيارة
  const [phone, setPhone] = useState('');
  const [custName, setCustName] = useState('');
  const [plateEmirate, setPlateEmirate] = useState<string>(EMIRATES[0]);
  const [plateCode, setPlateCode] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [plateCountry, setPlateCountry] = useState('');
  const [noPlate, setNoPlate] = useState(false);
  const [model, setModel] = useState('');
  const [bodyType, setBodyType] = useState<BodyType>('sedan');
  const [scanMsg, setScanMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // الخدمات
  const [washCode, setWashCode] = useState<string>('none');
  const [washManualPrice, setWashManualPrice] = useState<number>(0);
  const [addonChecked, setAddonChecked] = useState<Set<string>>(new Set());
  const [manualChecked, setManualChecked] = useState<Set<string>>(new Set());
  const [manualPrices, setManualPrices] = useState<Record<string, number>>(emptyManualPrices);

  // الدفع والتنفيذ
  const [payMethod, setPayMethod] = useState<PayMethod>('نقدي');
  const [payStatus, setPayStatus] = useState<PayStatus>('paid');
  const [cardType, setCardType] = useState<CardType>('debit');
  const [employeeId, setEmployeeId] = useState('');
  const [notes, setNotes] = useState('');

  // الملخص والتسوية
  const [reconcileDate, setReconcileDate] = useState(todayDate);
  const [bankSmsAmount, setBankSmsAmount] = useState(initialReconciliation ? String(initialReconciliation.bankNet) : '');
  const [reconcileResult, setReconcileResult] = useState<BankReconciliationResult | null>(initialReconciliation);
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);

  // المستحقات
  const [dueMode, setDueMode] = useState<'phone' | 'plate'>('phone');
  const [searchDue, setSearchDue] = useState('');
  const [dueEmirate, setDueEmirate] = useState<string>(EMIRATES[0]);
  const [dueCode, setDueCode] = useState('');
  const [dueNumber, setDueNumber] = useState('');
  const [dueCountry, setDueCountry] = useState('');
  const [pendingList, setPendingList] = useState<TransactionEntry[]>([]);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  const summary = useMemo(() => buildSummary(entries), [entries]);

  const selectedWash = config.washOptions.find((w) => w.code === washCode);
  const washPrice = selectedWash
    ? selectedWash.is_manual_price
      ? washManualPrice
      : bodyType === 'sedan'
        ? selectedWash.sedan_price
        : selectedWash.fourwd_price
    : 0;

  const total = useMemo(() => {
    let sum = washPrice;
    for (const code of addonChecked) {
      const a = config.addonServices.find((x) => x.code === code);
      if (a) sum += a.price;
    }
    for (const code of manualChecked) {
      sum += manualPrices[code] || 0;
    }
    return sum;
  }, [washPrice, addonChecked, manualChecked, manualPrices, config]);

  function resetSearchFields() {
    setSearchMode((m) => m);
    setQuickSearchInput('');
    setQsEmirate(EMIRATES[0]);
    setQsCode('');
    setQsNumber('');
    setQsCountry('');
    setLookupMsg(null);
    setVehicleChoices([]);
  }

  function fillVehicleFields(v: VehicleRecord) {
    setPlateEmirate(v.plate_emirate || EMIRATES[0]);
    setPlateCode(v.plate_code || '');
    setPlateNumber(v.plate_number || '');
    setPlateCountry(v.plate_country || '');
    setModel(v.model || '');
    setBodyType(v.body_type || 'sedan');
  }

  function plateDisplay(v: VehicleRecord): string {
    const emirate = v.plate_emirate === 'other' ? (v.plate_country || '—') : emirateLabel(v.plate_emirate, lang);
    return `${emirate} ${v.plate_code || ''} ${v.plate_number || ''}`.trim();
  }

  async function handleQuickSearch() {
    setVehicleChoices([]);
    if (searchMode === 'phone') {
      const q = quickSearchInput.trim();
      if (!q) return;
      setPhone(q);
      const result = await searchByPhone(q);
      if (result.customer?.name) setCustName(result.customer.name);

      if (result.vehicles.length === 0) {
        setLookupMsg({
          text: result.customer
            ? tr('✓ عميل مسجل مسبقاً — تم تعبئة الاسم. لا توجد سيارة سابقة مرتبطة، أدخل بيانات اللوحة يدوياً.')
            : tr('عميل جديد — تم نقل الرقم لخانة الجوال. أكمل باقي البيانات يدوياً.'),
        });
      } else if (result.vehicles.length === 1) {
        fillVehicleFields(result.vehicles[0]);
        const v = result.vehicles[0];
        const detailLine =
          lang === 'en'
            ? `✓ Registered customer — all details filled in automatically: 📍 Vehicle: ${plateDisplay(v)}${v.model ? ' — 🚗 ' + v.model : ''}. Just pick the service below.`
            : `✓ عميل مسجّل — تم تعبئة كل البيانات تلقائياً: 📍 السيارة: ${plateDisplay(v)}${v.model ? ' — 🚗 ' + v.model : ''}. باقي فقط اختيار الخدمة المطلوبة تحت.`;
        setLookupMsg({ text: detailLine });
      } else {
        setLookupMsg({
          text:
            lang === 'en'
              ? `✓ Registered customer — has ${result.vehicles.length} registered vehicles. Choose the one:`
              : `✓ عميل مسجّل — لديه ${result.vehicles.length} سيارات مسجّلة. اختر السيارة المطلوبة:`,
        });
        setVehicleChoices(result.vehicles);
      }
      return;
    }

    const number = qsNumber.trim();
    if (!number) return;
    const result = await searchByPlate({ plateEmirate: qsEmirate, plateCode: qsCode, plateNumber: number, plateCountry: qsCountry });
    if (result.vehicle) {
      if (result.customer) {
        setPhone(result.customer.phone);
        if (result.customer.name) setCustName(result.customer.name);
      }
      fillVehicleFields(result.vehicle);
      const emirateText = result.vehicle.plate_emirate === 'other' ? result.vehicle.plate_country || '—' : emirateLabel(result.vehicle.plate_emirate, lang);
      const text =
        lang === 'en'
          ? `✓ Vehicle already registered: 📍 Emirate: ${emirateText} — Code: ${result.vehicle.plate_code || '—'} — Number: ${
              result.vehicle.plate_number || '—'
            }. 📱 Phone: ${result.customer?.phone || '—'}${result.vehicle.model ? ' — 🚗 ' + result.vehicle.model : ''}. Review the filled data before saving.`
          : `✓ سيارة مسجّلة مسبقاً: 📍 الإمارة: ${emirateText} — الرمز: ${result.vehicle.plate_code || '—'} — الرقم: ${
              result.vehicle.plate_number || '—'
            }. 📱 الجوال: ${result.customer?.phone || '—'}${result.vehicle.model ? ' — 🚗 ' + result.vehicle.model : ''}. راجع البيانات المعبّأة تحت قبل الحفظ.`;
      setLookupMsg({ text });
    } else {
      setLookupMsg({ text: tr('سيارة جديدة — لا يوجد تطابق دقيق. أدخل بيانات اللوحة والعميل يدوياً تحت (أول زيارة فقط).') });
    }
  }

  function selectVehicleChoice(v: VehicleRecord) {
    fillVehicleFields(v);
    setVehicleChoices([]);
    const text =
      lang === 'en'
        ? `✓ Vehicle selected: ${plateDisplay(v)}${v.model ? ' — 🚗 ' + v.model : ''}. Just pick the service below.`
        : `✓ تم اختيار السيارة: ${plateDisplay(v)}${v.model ? ' — 🚗 ' + v.model : ''}. باقي فقط اختيار الخدمة المطلوبة تحت.`;
    setLookupMsg({ text });
  }

  async function handlePlateBlur() {
    if (noPlate) return;
    const number = plateNumber.trim();
    if (!number) return;
    const result = await searchByPlate({ plateEmirate, plateCode, plateNumber: number, plateCountry });
    if (result.vehicle) {
      if (result.customer) {
        setPhone(result.customer.phone);
        if (result.customer.name) setCustName(result.customer.name);
      }
      setModel(result.vehicle.model || '');
      setBodyType(result.vehicle.body_type || 'sedan');
      setScanMsg({ text: tr('✓ سيارة مسجّلة مسبقاً — تم تعبئة الجوال والموديل ونوع الهيكل تلقائياً. تأكد منها قبل الحفظ.') });
    } else {
      setScanMsg({ text: tr('سيارة جديدة — الرجاء تعبئة باقي البيانات يدوياً (أول زيارة فقط).') });
    }
  }

  function toggleAddon(code: string) {
    setAddonChecked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleManual(code: string) {
    setManualChecked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function setPay(method: PayMethod, status: PayStatus) {
    setPayMethod(method);
    setPayStatus(status);
  }

  function resetForm() {
    setPhone('');
    setCustName('');
    setPlateEmirate(EMIRATES[0]);
    setPlateCode('');
    setPlateNumber('');
    setPlateCountry('');
    setNoPlate(false);
    setModel('');
    setBodyType('sedan');
    setScanMsg(null);
    setWashCode('none');
    setWashManualPrice(0);
    setAddonChecked(new Set());
    setManualChecked(new Set());
    setManualPrices({});
    setPay('نقدي', 'paid');
    setCardType('debit');
    setNotes('');
    resetSearchFields();
    setEditingId(null);
  }

  const [formError, setFormError] = useState<string | null>(null);

  async function handleEdit(id: string) {
    setFormError(null);
    setLoadingEditId(id);
    try {
      const detail = await getTransactionDetail(id);
      setPhone(detail.phone);
      setCustName(detail.custName);
      setPlateEmirate(detail.plateEmirate || EMIRATES[0]);
      setPlateCode(detail.plateCode);
      setPlateNumber(detail.plateNumber);
      setPlateCountry(detail.plateCountry);
      setNoPlate(detail.isNoPlate);
      setModel(detail.model);
      setBodyType(detail.bodyType);
      setWashCode(detail.washCode || 'none');
      setWashManualPrice(detail.washManualPrice || 0);
      setAddonChecked(new Set(detail.addonCodes));
      setManualChecked(new Set(detail.manualEntries.map((m) => m.code)));
      setManualPrices(Object.fromEntries(detail.manualEntries.map((m) => [m.code, m.price])));
      setPay(detail.payMethod, detail.payStatus);
      if (detail.cardType) setCardType(detail.cardType);
      setEmployeeId(detail.employeeId);
      setNotes(detail.notes);
      setScanMsg(null);
      setEditingId(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setFormError(err?.message || tr('تعذّر تحميل بيانات العملية للتعديل.'));
    } finally {
      setLoadingEditId(null);
    }
  }

  function handleCancelEdit() {
    resetForm();
  }

  async function handleDelete(id: string) {
    if (!window.confirm(tr('متأكد تبغى تحذف هذي العملية؟ لا يمكن التراجع بعد الحذف.'))) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setPendingList((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) resetForm();
    try {
      await deleteTransaction(id);
    } catch (err: any) {
      setFormError(err?.message || tr('تعذّر حذف العملية — حدّث الصفحة وحاول مرة أخرى.'));
    }
  }

  async function handleSubmit() {
    setFormError(null);
    if (!phone.trim() || (!noPlate && !plateNumber.trim()) || (!washCode || washCode === 'none') && addonChecked.size === 0 && manualChecked.size === 0 || !employeeId) {
      setFormError(tr('الرجاء تعبئة: رقم الجوال، رقم اللوحة، خدمة واحدة على الأقل (غسيل أساسي أو إضافة)، والموظف المنفّذ.'));
      return;
    }
    if (selectedWash?.is_manual_price && washManualPrice <= 0) {
      setFormError(tr('أدخل سعر الغسيل الأساسي'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        phone: phone.trim(),
        custName: custName.trim(),
        plateEmirate,
        plateCode,
        plateNumber,
        plateCountry,
        isNoPlate: noPlate,
        model,
        bodyType,
        washCode: washCode !== 'none' ? washCode : null,
        washManualPrice,
        addonCodes: Array.from(addonChecked),
        manualEntries: Array.from(manualChecked).map((code) => ({ code, price: manualPrices[code] || 0 })),
        payMethod,
        payStatus,
        cardType: payMethod === 'بطاقة' ? cardType : null,
        employeeId,
        notes,
      };

      if (editingId) {
        const updated = await updateTransaction(editingId, payload);
        setEntries((prev) => prev.map((e) => (e.id === editingId ? updated : e)));
        setPendingList((prev) => prev.map((e) => (e.id === editingId ? updated : e)));
      } else {
        const entry = await submitTransaction(payload);
        setEntries((prev) => [entry, ...prev]);
      }
      resetForm();
    } catch (err: any) {
      setFormError(err?.message || tr('حدث خطأ أثناء الحفظ، حاول مرة أخرى.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReconcileDateChange(date: string) {
    setReconcileDate(date);
    setReconcileError(null);
    try {
      const existing = await getReconciliationForDate(date);
      setReconcileResult(existing);
      setBankSmsAmount(existing ? String(existing.bankNet) : '');
    } catch {
      /* تجاهل — يبقى الحقل فاضي لو تعذّر الجلب */
    }
  }

  async function handleReconcile() {
    setReconcileError(null);
    const amount = parseFloat(bankSmsAmount);
    if (Number.isNaN(amount)) return;
    setReconcileLoading(true);
    try {
      const result = await reconcileBankForDate(reconcileDate, amount);
      setReconcileResult(result);
    } catch (err: any) {
      setReconcileError(err?.message || tr('تعذّر حساب التسوية'));
      setReconcileResult(null);
    } finally {
      setReconcileLoading(false);
    }
  }

  function switchDueMode(mode: 'phone' | 'plate') {
    setDueMode(mode);
    setSearchDue('');
    setDueEmirate(EMIRATES[0]);
    setDueCode('');
    setDueNumber('');
    setDueCountry('');
    setPendingList([]);
    setPendingLoaded(false);
    setLastSearchQuery('');
  }

  async function handleSearchDue(q: string) {
    setSearchDue(q);
    setLastSearchQuery(q.trim());
    const results = await searchStatement(q.trim());
    setPendingList(results);
    setPendingLoaded(true);
  }

  async function handleSearchDuePlate() {
    const number = dueNumber.trim();
    if (!number) return;
    const query = { plateEmirate: dueEmirate, plateCode: dueCode, plateNumber: number, plateCountry: dueCountry };
    const displayPlate = dueEmirate === 'other' ? `${dueCountry || '—'} ${dueCode} ${number}`.trim() : `${dueEmirate} ${dueCode} ${number}`.trim();
    setLastSearchQuery(displayPlate);
    const results = await searchStatementByPlate(query);
    setPendingList(results);
    setPendingLoaded(true);
  }

  async function handleCollect(id: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, payStatus: 'paid', payMethod: 'محصّل لاحقاً' } : e))
    );
    setPendingList((prev) => prev.map((e) => (e.id === id ? { ...e, payStatus: 'paid', payMethod: 'محصّل لاحقاً' } : e)));
    startTransition(() => {
      collectPayment(id).catch(() => {
        /* التراجع اليدوي ممكن لاحقاً لو لزم — الأولوية الآن للاستجابة الفورية بالواجهة */
      });
    });
  }

  function shareStatement() {
    // نص المشاركة يبقى دائماً بالعربي لأنه موجّه للعميل (السوق محلي)، بغض النظر عن لغة واجهة الموظف الحالية.
    const list = pendingLoaded ? pendingList : entries.filter((e) => e.payStatus !== 'paid');
    if (list.length === 0) return;
    const grandTotal = list.reduce((s, e) => s + e.total, 0);
    const outstanding = list.filter((e) => e.payStatus !== 'paid').reduce((s, e) => s + e.total, 0);

    let msg = `*الشعلة لخدمة السيارات*\nكشف حساب — ${new Date().toLocaleDateString('ar-AE')}\n\n`;
    list.forEach((e) => {
      msg += `🚗 ${e.plate}\n📅 ${e.date} ⏰ ${e.time}\n🔧 ${joinServices(e.services, 'ar')}\n💰 ${e.total} AED — ${PAY_STATUS_LABEL_BY_LANG.ar[e.payStatus]}\n\n`;
    });
    msg += `——————————\n`;
    msg += `الإجمالي الكلي: ${grandTotal} AED\n`;
    if (outstanding > 0) msg += `المتبقي غير المحصَّل: ${outstanding} AED\n`;

    const encoded = encodeURIComponent(msg);
    const targetPhone = /^05\d{8}$/.test(lastSearchQuery) ? lastSearchQuery : /^05\d{8}$/.test(list[0].phone) ? list[0].phone : '';
    const url = targetPhone ? `https://wa.me/971${targetPhone.slice(1)}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  }

  const showList = pendingLoaded ? pendingList : entries.filter((e) => e.payStatus !== 'paid');
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div dir={dir}>
      <header>
        <div className="brand">
          <div>
            <h1>{lang === 'ar' ? 'الشعلة لخدمة السيارات' : 'AL SHULAH CARS SERVICE'}</h1>
            <div className="en">{lang === 'ar' ? 'AL SHULAH CARS SERVICE — كلباء' : 'الشعلة لخدمة السيارات — Kalba'}</div>
          </div>
          <div className="today-count">
            <div className="n">{entries.length}</div>
            <div className="l">{tr('سيارات اليوم')}</div>
          </div>
        </div>
        <div className="date-line">
          <span>{fmtDate(lang)}</span>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="button" onClick={toggleLang} className="logout-link" style={{ fontWeight: 700 }}>
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
            <a href="/admin">{tr('الإعدادات')}</a>
            <form action={logoutAction}>
              <button type="submit" className="logout-link">{tr('خروج')}</button>
            </form>
          </span>
        </div>
      </header>

      <main>
        <div className="card">
          <h2><span className="dot" /> {tr('بحث سريع')}</h2>
          <div className="pay-toggle" style={{ marginBottom: 10 }}>
            <button className={searchMode === 'phone' ? 'sel' : ''} onClick={() => { setSearchMode('phone'); resetSearchFields(); }}>{tr('برقم الجوال')}</button>
            <button className={searchMode === 'plate' ? 'sel' : ''} onClick={() => { setSearchMode('plate'); resetSearchFields(); }}>{tr('برقم اللوحة')}</button>
          </div>

          {searchMode === 'phone' ? (
            <div className="phone-row">
              <input type="text" placeholder="05XXXXXXXX" value={quickSearchInput} onChange={(e) => setQuickSearchInput(e.target.value)} />
              <button className="btn-lookup" onClick={handleQuickSearch}>{tr('بحث')}</button>
            </div>
          ) : (
            <div>
              <div className="plate-wrap">
                <select className="plate-emirate-select" value={qsEmirate} onChange={(e) => setQsEmirate(e.target.value)}>
                  {EMIRATES.map((em) => <option key={em} value={em}>{emirateLabel(em, lang)}</option>)}
                  <option value="other">{tr('دولة أخرى')}</option>
                </select>
                <input className="plate-code" type="text" placeholder={tr('الرمز')} value={qsCode} onChange={(e) => setQsCode(e.target.value)} />
                <input className="plate-number" type="text" placeholder={tr('الرقم')} value={qsNumber} onChange={(e) => setQsNumber(e.target.value)} />
              </div>
              {qsEmirate === 'other' && (
                <input type="text" placeholder={tr('اسم الدولة')} style={{ marginTop: 6 }} value={qsCountry} onChange={(e) => setQsCountry(e.target.value)} />
              )}
              <button className="btn-lookup" style={{ width: '100%', marginTop: 8 }} onClick={handleQuickSearch}>{tr('بحث')}</button>
            </div>
          )}

          {lookupMsg && <div className={`lookup-msg show${lookupMsg.isError ? ' error' : ''}`}>{lookupMsg.text}</div>}
          {vehicleChoices.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {vehicleChoices.map((v) => (
                <button key={v.id} className="btn-lookup" style={{ width: '100%', marginTop: 6, textAlign: 'inherit' }} onClick={() => selectVehicleChoice(v)}>
                  🚗 {plateDisplay(v)}{v.model ? ' — ' + v.model : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2><span className="dot" /> {tr('بيانات العميل')}</h2>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{tr('رقم الجوال')}</label>
            <input type="tel" placeholder="05XXXXXXXX" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
            <label>{tr('اسم العميل (اختياري)')}</label>
            <input type="text" placeholder={tr('يمكن تخطيه — رقم الجوال كافٍ للتعريف')} value={custName} onChange={(e) => setCustName(e.target.value)} />
          </div>
        </div>

        <div className="card">
          <h2><span className="dot" /> {tr('بيانات السيارة')}</h2>
          {scanMsg && <div className={`lookup-msg show${scanMsg.isError ? ' error' : ''}`}>{scanMsg.text}</div>}

          <div className="field">
            <label>{tr('رقم اللوحة')}</label>
            <div className={`plate-wrap${noPlate ? ' disabled' : ''}`}>
              <select className="plate-emirate-select" value={plateEmirate} disabled={noPlate} onChange={(e) => setPlateEmirate(e.target.value)}>
                {EMIRATES.map((em) => <option key={em} value={em}>{emirateLabel(em, lang)}</option>)}
                <option value="other">{tr('دولة أخرى')}</option>
              </select>
              <input className="plate-code" type="text" placeholder={tr('الرمز')} disabled={noPlate} value={plateCode} onChange={(e) => setPlateCode(e.target.value)} />
              <input className="plate-number" type="text" placeholder={tr('الرقم')} disabled={noPlate} value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} onBlur={handlePlateBlur} />
            </div>
            {plateEmirate === 'other' && !noPlate && (
              <input type="text" placeholder={tr('اسم الدولة (مثال: عُمان)')} style={{ marginTop: 6 }} value={plateCountry} onChange={(e) => setPlateCountry(e.target.value)} />
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 16, height: 16 }} checked={noPlate} onChange={(e) => setNoPlate(e.target.checked)} />
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{tr('بدون لوحة (سيارة معرض / وارد للبيع)')}</span>
            </label>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>{tr('نوع/موديل السيارة (اختياري)')}</label>
            <input type="text" placeholder={tr('مثال: تويوتا كامري')} value={model} onChange={(e) => setModel(e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
            <label>{tr('نوع الهيكل (يحدد السعر تلقائياً)')}</label>
            <select value={bodyType} onChange={(e) => setBodyType(e.target.value as BodyType)}>
              <option value="sedan">{BODY_LABEL_BY_LANG[lang].sedan}</option>
              <option value="fourwd">{BODY_LABEL_BY_LANG[lang].fourwd}</option>
            </select>
          </div>
        </div>

        <div className="card">
          <h2><span className="dot" /> {tr('الغسيل الأساسي')}</h2>
          <div className="field" style={{ marginBottom: 8 }}>
            <label>{tr('نوع الغسيل (السعر يظهر تلقائياً حسب نوع الهيكل)')}</label>
            <select value={washCode} onChange={(e) => { setWashCode(e.target.value); setWashManualPrice(0); }}>
              <option value="none">{tr('بدون غسيل أساسي')}</option>
              {config.washOptions.map((w) => <option key={w.code} value={w.code}>{catalogLabel(w, lang)}</option>)}
            </select>
          </div>
          {selectedWash && selectedWash.is_manual_price && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{tr('أدخل سعر الغسيل الأساسي')}</label>
              <input
                type="number"
                className="svc-price"
                style={{ width: 120 }}
                value={washManualPrice || ''}
                onChange={(e) => setWashManualPrice(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
          {selectedWash && !selectedWash.is_manual_price && (
            <div style={{ fontSize: 12.5, color: 'var(--petrol-2)', fontWeight: 700 }}>
              {lang === 'ar'
                ? `السعر (${BODY_LABEL_BY_LANG.ar[bodyType]}): ${washPrice} AED`
                : `Price (${BODY_LABEL_BY_LANG.en[bodyType]}): ${washPrice} AED`}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <label style={{ marginBottom: 8 }}>{tr('إضافات الغسيل (اختياري)')}</label>
            <div className="services">
              {config.addonServices.map((a) => (
                <div key={a.code} className={`svc-row${addonChecked.has(a.code) ? ' active' : ''}`}>
                  <input type="checkbox" checked={addonChecked.has(a.code)} onChange={() => toggleAddon(a.code)} />
                  <div className="svc-name">{catalogLabel(a, lang)}<span className="svc-tag">{tr('سعر ثابت')}</span></div>
                  <input type="number" className="svc-price" value={a.price} readOnly />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <h2><span className="dot" /> {tr('خدمات إضافية (تُدخل يدوياً)')}</h2>
          <div className="services">
            {config.manualServices.map((m) => {
              const hint = lang === 'en' ? m.hint_en || m.hint : m.hint;
              return (
                <div key={m.code} className={`svc-row${manualChecked.has(m.code) ? ' active' : ''}`}>
                  <input type="checkbox" checked={manualChecked.has(m.code)} onChange={() => toggleManual(m.code)} />
                  <div className="svc-name">{catalogLabel(m, lang)}<span className="svc-tag">{hint || tr('يُدخل يدوياً')}</span></div>
                  <input
                    type="number"
                    className="svc-price"
                    value={manualPrices[m.code] ?? 0}
                    onChange={(e) => setManualPrices((prev) => ({ ...prev, [m.code]: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="total-box">
          <div><div className="lbl">{tr('الإجمالي')}</div></div>
          <div className="amt">{total}<span>AED</span></div>
        </div>

        <div className="card">
          <h2><span className="dot" /> {tr('الدفع والتنفيذ')}</h2>
          <div className="field">
            <label>{tr('حالة الدفع')}</label>
            <div className="pay-toggle">
              <button className={payMethod === 'نقدي' ? 'sel' : ''} onClick={() => setPay('نقدي', 'paid')}>{PAY_METHOD_LABEL_BY_LANG[lang]['نقدي']}</button>
              <button className={payMethod === 'بطاقة' ? 'sel' : ''} onClick={() => setPay('بطاقة', 'paid')}>{PAY_METHOD_LABEL_BY_LANG[lang]['بطاقة']}</button>
            </div>
            <div className="pay-toggle" style={{ marginTop: 8 }}>
              <button className={payMethod === 'آجل' ? 'sel' : ''} onClick={() => setPay('آجل', 'pending')}>{PAY_METHOD_LABEL_BY_LANG[lang]['آجل']}</button>
            </div>
            {payMethod === 'بطاقة' && (
              <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                <label>{tr('نوع البطاقة')}</label>
                <select value={cardType} onChange={(e) => setCardType(e.target.value as CardType)}>
                  {config.cardRates.map((r) => (
                    <option key={r.card_type} value={r.card_type}>{lang === 'en' && r.label_en ? r.label_en : r.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="field">
            <label>{tr('الموظف المنفّذ')}</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">{tr('اختر الموظف')}</option>
              {config.employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{tr('ملاحظات (اختياري)')}</label>
            <textarea placeholder={tr('أي ملاحظات إضافية...')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {editingId && (
          <div className="lookup-msg show" style={{ marginBottom: 10 }}>
            {tr('✏️ أنت الحين تعدّل عملية سابقة — الحفظ راح يحدّثها بدل ما يسجّل عملية جديدة.')}
          </div>
        )}
        {formError && <div className="lookup-msg show error" style={{ marginBottom: 10 }}>{formError}</div>}
        <button className="submit-btn" disabled={submitting} onClick={handleSubmit}>
          {submitting ? tr('جاري الحفظ...') : editingId ? tr('حفظ التعديلات') : tr('تسجيل العملية')}
        </button>
        {editingId && (
          <button
            className="btn-lookup"
            style={{ width: '100%', marginTop: 8, background: '#fff', color: 'var(--muted)', border: '1.5px solid var(--line)' }}
            onClick={handleCancelEdit}
          >
            {tr('إلغاء التعديل')}
          </button>
        )}

        <div className="card" style={{ marginTop: 14 }}>
          <h2><span className="dot" /> {tr('ملخص اليوم المالي')}</h2>
          <div>
            <div className="sum-row collected">
              <span className="sk">
                {tr('مُحصَّل فعلياً')}
                <span className="sub">
                  {lang === 'ar'
                    ? `نقدي ${summary.cash} + بطاقة ${summary.cardNet.toFixed(2)}${summary.collectedLater ? ' + محصّل لاحقاً ' + summary.collectedLater : ''}`
                    : `Cash ${summary.cash} + Card ${summary.cardNet.toFixed(2)}${summary.collectedLater ? ' + Collected later ' + summary.collectedLater : ''}`}
                </span>
              </span>
              <span className="sv">{summary.collected.toFixed(2)} AED</span>
            </div>
            <div className="sum-row pending">
              <span className="sk">{tr('آجل — غير محصَّل (لحين السداد)')}</span>
              <span className="sv">{summary.pending} AED</span>
            </div>
            <div className="sum-row grand">
              <span className="sk">{tr('الإجمالي الكلي (حجم المبيعات)')}</span>
              <span className="sv">{summary.grand} AED</span>
            </div>
          </div>

          <div style={{ borderTop: '1px dashed var(--line)', marginTop: 12, paddingTop: 12 }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--petrol)', marginBottom: 6, display: 'block' }}>
              {tr('🏦 تسوية مع رسالة البنك (لأي تاريخ)')}
            </label>
            <div className="row2" style={{ marginBottom: 8 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>{tr('التاريخ')}</label>
                <input type="date" value={reconcileDate} max={todayDate} onChange={(e) => handleReconcileDateChange(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>{tr('المبلغ الفعلي من رسالة البنك')}</label>
                <input type="number" value={bankSmsAmount} onChange={(e) => setBankSmsAmount(e.target.value)} />
              </div>
            </div>
            <button className="btn-lookup" style={{ width: '100%' }} disabled={reconcileLoading} onClick={handleReconcile}>
              {reconcileLoading ? tr('جاري الحساب...') : tr('احسب واحفظ')}
            </button>
            {reconcileError && <div className="lookup-msg show error" style={{ marginTop: 8 }}>{reconcileError}</div>}
            {reconcileResult && (
              <div style={{ fontSize: 12.5, marginTop: 8 }}>
                <div style={{ background: '#f3f1eb', borderRadius: 8, padding: 10 }}>
                  {tr('إجمالي البطاقة بالنظام:')} <b>{reconcileResult.cardGrossToday} AED</b><br />
                  {tr('الوارد فعلياً من البنك:')} <b>{reconcileResult.bankNet} AED</b><br />
                  {tr('العمولة الفعلية:')} <b style={{ color: '#a33' }}>{reconcileResult.actualCommission.toFixed(2)} AED</b><br />
                  {tr('النسبة الفعلية:')} <b style={{ color: 'var(--petrol)' }}>{reconcileResult.actualRate.toFixed(2)}%</b>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2><span className="dot" /> {tr('المستحقات / كشف حساب عميل')}</h2>
          <div className="pay-toggle" style={{ marginBottom: 10 }}>
            <button className={dueMode === 'phone' ? 'sel' : ''} onClick={() => switchDueMode('phone')}>{tr('برقم الجوال')}</button>
            <button className={dueMode === 'plate' ? 'sel' : ''} onClick={() => switchDueMode('plate')}>{tr('برقم اللوحة')}</button>
          </div>

          {dueMode === 'phone' ? (
            <div className="field">
              <div className="phone-row">
                <input type="text" placeholder={tr('رقم الجوال (كل سيارات نفس الشخص)')} value={searchDue} onChange={(e) => handleSearchDue(e.target.value)} />
                <button className="btn-lookup" onClick={() => handleSearchDue(searchDue)}>{tr('بحث')}</button>
              </div>
            </div>
          ) : (
            <div className="field">
              <div className="plate-wrap">
                <select className="plate-emirate-select" value={dueEmirate} onChange={(e) => setDueEmirate(e.target.value)}>
                  {EMIRATES.map((em) => <option key={em} value={em}>{emirateLabel(em, lang)}</option>)}
                  <option value="other">{tr('دولة أخرى')}</option>
                </select>
                <input className="plate-code" type="text" placeholder={tr('الرمز')} value={dueCode} onChange={(e) => setDueCode(e.target.value)} />
                <input className="plate-number" type="text" placeholder={tr('الرقم')} value={dueNumber} onChange={(e) => setDueNumber(e.target.value)} />
              </div>
              {dueEmirate === 'other' && (
                <input type="text" placeholder={tr('اسم الدولة')} style={{ marginTop: 6 }} value={dueCountry} onChange={(e) => setDueCountry(e.target.value)} />
              )}
              <button className="btn-lookup" style={{ width: '100%', marginTop: 8 }} onClick={handleSearchDuePlate}>{tr('بحث')}</button>
            </div>
          )}

          {showList.length === 0 ? (
            <div className="empty-log">{lastSearchQuery ? tr('لا توجد عمليات مطابقة للبحث') : tr('لا توجد مستحقات غير مسددة')}</div>
          ) : (
            <>
              <div style={{ background: '#f3f1eb', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                  <span>{tr('عدد العمليات:')} {showList.length}</span>
                  <span>{tr('إجمالي كل العمليات:')} <b style={{ color: 'var(--petrol)' }}>{showList.reduce((s, e) => s + e.total, 0)} AED</b></span>
                </div>
                {(() => {
                  const outstanding = showList.filter((e) => e.payStatus !== 'paid').reduce((s, e) => s + e.total, 0);
                  return outstanding > 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: 'var(--muted)' }}>{tr('منها غير محصَّل:')}</span>
                      <span style={{ fontFamily: "'Tajawal',sans-serif", fontWeight: 900, color: '#b8741c' }}>{outstanding} AED</span>
                    </div>
                  ) : null;
                })()}
              </div>
              {showList.map((e) => (
                <div key={e.id} className="log-item" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div className="li-main">{e.plate}</div>
                    <div className="li-sub">{e.date} · {e.time} · {joinServices(e.services, lang)}</div>
                    <div className="li-sub" style={{ color: e.payStatus === 'paid' ? 'var(--success)' : '#b8741c', fontWeight: 700 }}>{PAY_STATUS_LABEL_BY_LANG[lang][e.payStatus]}</div>
                  </div>
                  <div style={{ textAlign: 'end' }}>
                    <div className="li-amt" style={{ marginBottom: 6 }}>{e.total} <span style={{ fontSize: 10 }}>AED</span></div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {e.payStatus !== 'paid' && (
                        <button className="btn-lookup" style={{ fontSize: 11, padding: '6px 10px' }} onClick={() => handleCollect(e.id)}>{tr('تحصيل الآن')}</button>
                      )}
                      <button
                        className="btn-lookup"
                        style={{ fontSize: 11, padding: '6px 10px' }}
                        disabled={loadingEditId === e.id}
                        onClick={() => handleEdit(e.id)}
                      >
                        {loadingEditId === e.id ? '...' : tr('تعديل')}
                      </button>
                      <button
                        className="btn-lookup"
                        style={{ fontSize: 11, padding: '6px 10px', background: '#a33' }}
                        onClick={() => handleDelete(e.id)}
                      >
                        {tr('حذف')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {lastSearchQuery && (
                <button className="btn-lookup" style={{ width: '100%', marginTop: 10, background: '#25D366', color: '#fff' }} onClick={shareStatement}>
                  {tr('📤 مشاركة الكشف عبر واتساب')}
                </button>
              )}
            </>
          )}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h2><span className="dot" /> {tr('سجل اليوم')}</h2>
          {entries.length === 0 ? (
            <div className="empty-log">{tr('لا توجد عمليات مسجلة اليوم بعد')}</div>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="log-item" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="li-main">{e.customerName} — {e.plate}</div>
                  <div className="li-sub">
                    {joinServices(e.services, lang)} · {e.employeeName} · {e.time} ·{' '}
                    <span style={{ color: e.payStatus === 'paid' ? 'var(--success)' : '#b8741c', fontWeight: 700 }}>{PAY_STATUS_LABEL_BY_LANG[lang][e.payStatus]}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'end' }}>
                  <div className="li-amt" style={{ marginBottom: 6 }}>{e.total} <span style={{ fontSize: 10 }}>AED</span></div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      className="btn-lookup"
                      style={{ fontSize: 11, padding: '6px 10px' }}
                      disabled={loadingEditId === e.id}
                      onClick={() => handleEdit(e.id)}
                    >
                      {loadingEditId === e.id ? '...' : tr('تعديل')}
                    </button>
                    <button
                      className="btn-lookup"
                      style={{ fontSize: 11, padding: '6px 10px', background: '#a33' }}
                      onClick={() => handleDelete(e.id)}
                    >
                      {tr('حذف')}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
