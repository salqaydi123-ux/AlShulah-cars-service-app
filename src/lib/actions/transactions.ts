'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type {
  BankReconciliationResult,
  BodyType,
  SubmitTransactionInput,
  TodaySummary,
  TransactionDetail,
  TransactionEntry,
} from '@/lib/types';

function todayDateStr(): string {
  // YYYY-MM-DD بتوقيت الخادم — يكفي لتطبيق فرع واحد بمنطقة زمنية واحدة (الإمارات).
  return new Date().toLocaleDateString('en-CA');
}

export async function getServerTodayDate(): Promise<string> {
  return todayDateStr();
}

function buildPlateDisplay(v: {
  plate_emirate: string;
  plate_code: string;
  plate_number: string;
  plate_country?: string | null;
  is_no_plate: boolean;
}): string {
  if (v.is_no_plate) return v.plate_number || 'بدون لوحة — معرض';
  if (v.plate_emirate === 'other') {
    return `${v.plate_country || 'دولة غير محددة'} ${v.plate_code} ${v.plate_number}`.trim();
  }
  return `${v.plate_emirate} ${v.plate_code} ${v.plate_number}`.trim();
}

function mapTxRow(row: any): TransactionEntry {
  return {
    id: row.id,
    date: row.tx_date,
    time: String(row.tx_time).slice(0, 5),
    customerName: row.customers?.name || 'عميلنا العزيز',
    phone: row.customers?.phone || '',
    plate: row.vehicle_plate_snapshot,
    model: null,
    employeeName: row.employee_name_snapshot,
    payMethod: row.pay_method,
    payStatus: row.pay_status,
    cardType: row.card_type,
    commissionAmount: Number(row.commission_amount),
    netAmount: Number(row.net_amount),
    total: Number(row.total),
    notes: row.notes,
    services: (row.transaction_services ?? []).map((s: any) => ({ name: s.service_name, nameEn: s.service_name_en })),
  };
}

const TX_SELECT = '*, customers(phone, name), transaction_services(service_name, service_name_en)';

function validateInput(input: SubmitTransactionInput) {
  if (!input.phone.trim()) throw new Error('رقم الجوال مطلوب');
  if (!input.isNoPlate && !input.plateNumber.trim()) throw new Error('رقم اللوحة مطلوب');
  if (!input.employeeId) throw new Error('الموظف المنفّذ مطلوب');
  if (!input.washCode && input.addonCodes.length === 0 && input.manualEntries.length === 0) {
    throw new Error('اختر خدمة واحدة على الأقل');
  }
}

type VehicleDisplay = { plate_emirate: string; plate_code: string; plate_number: string; plate_country: string | null; is_no_plate: boolean };

async function upsertCustomerAndVehicle(
  db: ReturnType<typeof supabaseAdmin>,
  input: SubmitTransactionInput
): Promise<{ customerId: string; vehicleId: string; vehicleDisplay: VehicleDisplay }> {
  const phone = input.phone.trim();
  const nameRaw = input.custName.trim();

  // العميل — إيجاد أو إنشاء بمفتاح رقم الجوال
  const { data: existingCustomer, error: custFindErr } = await db
    .from('customers')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();
  if (custFindErr) throw new Error(custFindErr.message);

  let customerId: string;
  if (existingCustomer) {
    customerId = existingCustomer.id;
    if (nameRaw && nameRaw !== existingCustomer.name) {
      const { error } = await db.from('customers').update({ name: nameRaw, updated_at: new Date().toISOString() }).eq('id', customerId);
      if (error) throw new Error(error.message);
    }
  } else {
    const { data, error } = await db.from('customers').insert({ phone, name: nameRaw || null }).select('id').single();
    if (error) throw new Error(error.message);
    customerId = data.id;
  }

  // السيارة — إيجاد أو إنشاء بمفتاح (الإمارة+الرمز+الرقم)، أو إنشاء سجل مؤقت لسيارات بدون لوحة
  let vehicleId: string;
  let vehicleDisplay: VehicleDisplay;

  if (input.isNoPlate) {
    const tempRef = 'بدون لوحة — معرض #' + Date.now().toString().slice(-5);
    const { data, error } = await db
      .from('vehicles')
      .insert({
        customer_id: customerId,
        plate_emirate: '',
        plate_code: '',
        plate_number: tempRef,
        plate_country: null,
        is_no_plate: true,
        model: input.model.trim() || null,
        body_type: input.bodyType,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    vehicleId = data.id;
    vehicleDisplay = { plate_emirate: '', plate_code: '', plate_number: tempRef, plate_country: null, is_no_plate: true };
  } else {
    const plateEmirate = input.plateEmirate;
    const plateCode = input.plateCode.trim();
    const plateNumber = input.plateNumber.trim();
    const plateCountry = plateEmirate === 'other' ? input.plateCountry.trim() : null;

    let existingVehicleQuery = db
      .from('vehicles')
      .select('*')
      .eq('plate_emirate', plateEmirate)
      .eq('plate_code', plateCode)
      .eq('plate_number', plateNumber)
      .eq('is_no_plate', false);
    existingVehicleQuery = plateCountry ? existingVehicleQuery.eq('plate_country', plateCountry) : existingVehicleQuery.is('plate_country', null);

    const { data: existingVehicle, error: vehFindErr } = await existingVehicleQuery.maybeSingle();
    if (vehFindErr) throw new Error(vehFindErr.message);

    const patch = {
      customer_id: customerId,
      model: input.model.trim() || null,
      body_type: input.bodyType as BodyType,
      updated_at: new Date().toISOString(),
    };

    if (existingVehicle) {
      vehicleId = existingVehicle.id;
      const { error } = await db.from('vehicles').update(patch).eq('id', vehicleId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await db
        .from('vehicles')
        .insert({ plate_emirate: plateEmirate, plate_code: plateCode, plate_number: plateNumber, plate_country: plateCountry, is_no_plate: false, ...patch })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      vehicleId = data.id;
    }

    vehicleDisplay = { plate_emirate: plateEmirate, plate_code: plateCode, plate_number: plateNumber, plate_country: plateCountry, is_no_plate: false };
  }

  return { customerId, vehicleId, vehicleDisplay };
}

async function buildServiceRows(db: ReturnType<typeof supabaseAdmin>, input: SubmitTransactionInput) {
  const serviceRows: { service_group: 'wash' | 'addon' | 'manual'; service_code: string; service_name: string; service_name_en: string | null; price: number }[] = [];

  if (input.washCode) {
    const { data: wash, error } = await db.from('wash_options').select('*').eq('code', input.washCode).eq('is_current', true).maybeSingle();
    if (error) throw new Error(error.message);
    if (!wash) throw new Error('نوع الغسيل غير موجود بالإعدادات الحالية');
    let price = input.bodyType === 'sedan' ? wash.sedan_price : wash.fourwd_price;
    if (wash.is_manual_price) {
      if (!input.washManualPrice || input.washManualPrice <= 0) throw new Error('أدخل سعر الغسيل الأساسي');
      price = input.washManualPrice;
    }
    serviceRows.push({ service_group: 'wash', service_code: wash.code, service_name: wash.name, service_name_en: wash.name_en, price });
  }

  if (input.addonCodes.length > 0) {
    const { data: addons, error } = await db.from('addon_services').select('*').in('code', input.addonCodes).eq('is_current', true);
    if (error) throw new Error(error.message);
    for (const a of addons ?? []) {
      let price = a.price;
      if (a.is_manual_price) {
        const entry = input.addonManualPrices.find((m) => m.code === a.code);
        if (!entry || entry.price <= 0) throw new Error(`أدخل سعر ${a.name}`);
        price = entry.price;
      }
      serviceRows.push({ service_group: 'addon', service_code: a.code, service_name: a.name, service_name_en: a.name_en, price });
    }
  }

  if (input.manualEntries.length > 0) {
    const codes = input.manualEntries.map((m) => m.code);
    const { data: manuals, error } = await db.from('manual_services').select('*').in('code', codes).eq('is_current', true);
    if (error) throw new Error(error.message);
    for (const m of input.manualEntries) {
      const def = manuals?.find((x) => x.code === m.code);
      if (!def) continue;
      serviceRows.push({ service_group: 'manual', service_code: def.code, service_name: def.name, service_name_en: def.name_en, price: m.price });
    }
  }

  return serviceRows;
}

export async function submitTransaction(input: SubmitTransactionInput): Promise<TransactionEntry> {
  validateInput(input);
  const db = supabaseAdmin();

  const { customerId, vehicleId, vehicleDisplay } = await upsertCustomerAndVehicle(db, input);
  const serviceRows = await buildServiceRows(db, input);
  const total = serviceRows.reduce((s, r) => s + r.price, 0);

  const { data: employee, error: empErr } = await db.from('employees').select('*').eq('id', input.employeeId).maybeSingle();
  if (empErr) throw new Error(empErr.message);
  if (!employee) throw new Error('الموظف غير موجود');

  const now = new Date();
  const { data: tx, error: txErr } = await db
    .from('transactions')
    .insert({
      customer_id: customerId,
      vehicle_id: vehicleId,
      vehicle_plate_snapshot: buildPlateDisplay(vehicleDisplay),
      tx_date: todayDateStr(),
      tx_time: now.toTimeString().slice(0, 8),
      employee_id: employee.id,
      employee_name_snapshot: employee.name,
      pay_status: input.payStatus,
      pay_method: input.payMethod,
      card_type: input.cardType,
      // العمولة ما تُخصم تلقائياً وقت التسجيل — يُسجَّل المبلغ الكامل، وتُكتشف العمولة الفعلية لاحقاً عبر تسوية رسالة البنك.
      commission_rate_snapshot: 0,
      commission_amount: 0,
      net_amount: total,
      total,
      notes: input.notes.trim() || null,
    })
    .select('*')
    .single();
  if (txErr) throw new Error(txErr.message);

  const { error: svcErr } = await db.from('transaction_services').insert(serviceRows.map((r) => ({ transaction_id: tx.id, ...r })));
  if (svcErr) throw new Error(svcErr.message);

  return {
    id: tx.id,
    date: tx.tx_date,
    time: tx.tx_time.slice(0, 5),
    customerName: input.custName.trim() || 'عميلنا العزيز',
    phone: input.phone.trim(),
    plate: tx.vehicle_plate_snapshot,
    model: input.model.trim() || null,
    employeeName: employee.name,
    payMethod: tx.pay_method,
    payStatus: tx.pay_status,
    cardType: tx.card_type,
    commissionAmount: tx.commission_amount,
    netAmount: tx.net_amount,
    total: tx.total,
    notes: tx.notes,
    services: serviceRows.map((r) => ({ name: r.service_name, nameEn: r.service_name_en })),
  };
}

export async function updateTransaction(transactionId: string, input: SubmitTransactionInput): Promise<TransactionEntry> {
  validateInput(input);
  const db = supabaseAdmin();

  const { data: existingTx, error: existingErr } = await db.from('transactions').select('tx_date, tx_time').eq('id', transactionId).maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  if (!existingTx) throw new Error('العملية غير موجودة — ربما تم حذفها مسبقاً');

  const { customerId, vehicleId, vehicleDisplay } = await upsertCustomerAndVehicle(db, input);
  const serviceRows = await buildServiceRows(db, input);
  const total = serviceRows.reduce((s, r) => s + r.price, 0);

  const { data: employee, error: empErr } = await db.from('employees').select('*').eq('id', input.employeeId).maybeSingle();
  if (empErr) throw new Error(empErr.message);
  if (!employee) throw new Error('الموظف غير موجود');

  const { data: tx, error: txErr } = await db
    .from('transactions')
    .update({
      customer_id: customerId,
      vehicle_id: vehicleId,
      vehicle_plate_snapshot: buildPlateDisplay(vehicleDisplay),
      employee_id: employee.id,
      employee_name_snapshot: employee.name,
      pay_status: input.payStatus,
      pay_method: input.payMethod,
      card_type: input.cardType,
      commission_rate_snapshot: 0,
      commission_amount: 0,
      net_amount: total,
      total,
      notes: input.notes.trim() || null,
    })
    .eq('id', transactionId)
    .select('*')
    .single();
  if (txErr) throw new Error(txErr.message);

  // نستبدل خدمات العملية بالكامل بدل تعديلها سطر بسطر — أبسط ويطابق دائماً الاختيار الحالي بالنموذج
  const { error: delErr } = await db.from('transaction_services').delete().eq('transaction_id', transactionId);
  if (delErr) throw new Error(delErr.message);
  const { error: svcErr } = await db.from('transaction_services').insert(serviceRows.map((r) => ({ transaction_id: transactionId, ...r })));
  if (svcErr) throw new Error(svcErr.message);

  return {
    id: tx.id,
    date: tx.tx_date,
    time: String(tx.tx_time).slice(0, 5),
    customerName: input.custName.trim() || 'عميلنا العزيز',
    phone: input.phone.trim(),
    plate: tx.vehicle_plate_snapshot,
    model: input.model.trim() || null,
    employeeName: employee.name,
    payMethod: tx.pay_method,
    payStatus: tx.pay_status,
    cardType: tx.card_type,
    commissionAmount: tx.commission_amount,
    netAmount: tx.net_amount,
    total: tx.total,
    notes: tx.notes,
    services: serviceRows.map((r) => ({ name: r.service_name, nameEn: r.service_name_en })),
  };
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from('transactions').delete().eq('id', transactionId);
  if (error) throw new Error(error.message);
}

export async function getTransactionDetail(transactionId: string): Promise<TransactionDetail> {
  const db = supabaseAdmin();
  const { data: tx, error } = await db
    .from('transactions')
    .select('*, customers(phone, name), vehicles(*), transaction_services(*)')
    .eq('id', transactionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tx) throw new Error('العملية غير موجودة — ربما تم حذفها مسبقاً');

  const vehicle = tx.vehicles;
  const services: { service_group: string; service_code: string; price: number }[] = tx.transaction_services ?? [];
  const washRow = services.find((s) => s.service_group === 'wash');
  const addonEntries = services.filter((s) => s.service_group === 'addon').map((s) => ({ code: s.service_code, price: Number(s.price) }));
  const addonCodes = addonEntries.map((e) => e.code);
  const manualEntries = services.filter((s) => s.service_group === 'manual').map((s) => ({ code: s.service_code, price: Number(s.price) }));

  return {
    id: tx.id,
    phone: tx.customers?.phone ?? '',
    custName: tx.customers?.name ?? '',
    plateEmirate: vehicle?.plate_emirate || 'الشارقة',
    plateCode: vehicle?.plate_code || '',
    plateNumber: vehicle?.is_no_plate ? '' : vehicle?.plate_number || '',
    plateCountry: vehicle?.plate_country || '',
    isNoPlate: vehicle?.is_no_plate ?? false,
    model: vehicle?.model || '',
    bodyType: vehicle?.body_type || 'sedan',
    washCode: washRow ? washRow.service_code : null,
    washManualPrice: washRow ? Number(washRow.price) : 0,
    addonCodes,
    addonManualPrices: addonEntries,
    manualEntries,
    payMethod: tx.pay_method,
    payStatus: tx.pay_status,
    cardType: tx.card_type,
    employeeId: tx.employee_id || '',
    notes: tx.notes || '',
  };
}

export async function listToday(): Promise<TransactionEntry[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('transactions')
    .select(TX_SELECT)
    .eq('tx_date', todayDateStr())
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTxRow);
}

export async function getTodaySummary(): Promise<TodaySummary> {
  const entries = await listToday();

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

export async function searchStatement(query: string): Promise<TransactionEntry[]> {
  const db = supabaseAdmin();
  const q = query.trim();

  let rowsQuery = db.from('transactions').select(TX_SELECT).order('created_at', { ascending: false });

  // نجلب دفعة معقولة ونفلتر بالجافاسكربت بدل الاعتماد على or() عبر جدول مرتبط (سلوكه غير موثوق بـ PostgREST).
  rowsQuery = q ? rowsQuery.limit(1000) : rowsQuery.eq('pay_status', 'pending').limit(500);

  const { data, error } = await rowsQuery;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter((row: any) => {
    if (!q) return true;
    return (row.customers?.phone || '').includes(q);
  });

  return rows.map(mapTxRow);
}

export interface PlateExactQuery {
  plateEmirate: string;
  plateCode: string;
  plateNumber: string;
  plateCountry: string;
}

// كشف حساب بمطابقة تامة على اللوحة (الإمارة + الرمز + الرقم كاملين) — يجيب كل تاريخ السيارة، وليس بحث جزئي بالنص.
export async function searchStatementByPlate(query: PlateExactQuery): Promise<TransactionEntry[]> {
  const db = supabaseAdmin();
  const code = query.plateCode.trim();
  const number = query.plateNumber.trim();
  if (!number) return [];
  const country = query.plateEmirate === 'other' ? query.plateCountry.trim() : '';

  let vq = db
    .from('vehicles')
    .select('id')
    .eq('plate_emirate', query.plateEmirate)
    .eq('plate_code', code)
    .eq('plate_number', number)
    .eq('is_no_plate', false);
  vq = country ? vq.eq('plate_country', country) : vq.is('plate_country', null);

  const { data: vehicle, error: vErr } = await vq.maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!vehicle) return [];

  const { data, error } = await db
    .from('transactions')
    .select(TX_SELECT)
    .eq('vehicle_id', vehicle.id)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map(mapTxRow);
}

export async function collectPayment(transactionId: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from('transactions')
    .update({ pay_status: 'paid', pay_method: 'محصّل لاحقاً' })
    .eq('id', transactionId);
  if (error) throw new Error(error.message);
}

async function getCardGrossForDate(db: ReturnType<typeof supabaseAdmin>, date: string): Promise<number> {
  const { data, error } = await db
    .from('transactions')
    .select('total')
    .eq('tx_date', date)
    .eq('pay_status', 'paid')
    .eq('pay_method', 'بطاقة');
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((s: number, r: any) => s + Number(r.total), 0);
}

export async function reconcileBankForDate(date: string, bankNet: number): Promise<BankReconciliationResult> {
  const db = supabaseAdmin();
  const cardGrossToday = await getCardGrossForDate(db, date);

  if (cardGrossToday === 0) {
    throw new Error('لا توجد عمليات بطاقة بهذا التاريخ للمقارنة.');
  }

  const actualCommission = cardGrossToday - bankNet;
  const actualRate = (actualCommission / cardGrossToday) * 100;

  const { error } = await db.from('bank_reconciliation').upsert(
    {
      tx_date: date,
      card_gross: cardGrossToday,
      bank_net: bankNet,
      actual_commission: actualCommission,
      actual_rate: actualRate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tx_date' }
  );
  if (error) throw new Error(error.message);

  return { cardGrossToday, bankNet, actualCommission, actualRate };
}

export async function getReconciliationForDate(date: string): Promise<BankReconciliationResult | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.from('bank_reconciliation').select('*').eq('tx_date', date).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    cardGrossToday: Number(data.card_gross),
    bankNet: Number(data.bank_net),
    actualCommission: Number(data.actual_commission),
    actualRate: Number(data.actual_rate),
  };
}
