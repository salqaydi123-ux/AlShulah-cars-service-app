export type BodyType = 'sedan' | 'fourwd';
export type PayStatus = 'paid' | 'pending';
export type PayMethod = 'نقدي' | 'بطاقة' | 'آجل' | 'محصّل لاحقاً';
export type CardType = 'debit' | 'credit' | 'amex';
export type ServiceGroup = 'wash' | 'addon' | 'manual';

export interface WashOption {
  id: string;
  code: string;
  name: string;
  name_en: string | null;
  sedan_price: number;
  fourwd_price: number;
  is_manual_price: boolean;
  sort_order: number;
}

export interface AddonService {
  id: string;
  code: string;
  name: string;
  name_en: string | null;
  price: number;
  is_manual_price: boolean;
  sort_order: number;
}

export interface ManualService {
  id: string;
  code: string;
  name: string;
  name_en: string | null;
  hint: string | null;
  hint_en: string | null;
  sort_order: number;
}

export interface CardCommissionRate {
  id: string;
  card_type: CardType;
  label: string;
  label_en: string | null;
  rate_percent: number;
}

export interface Employee {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
}

export interface FormConfig {
  washOptions: WashOption[];
  addonServices: AddonService[];
  manualServices: ManualService[];
  cardRates: CardCommissionRate[];
  employees: Employee[];
}

export interface ExpenseAccountOption {
  account_code: string;
  account_name_ar: string;
  account_name_en: string | null;
}

export interface PayrollMonthRow {
  worker_id: string;
  full_name: string;
  compensation_type: string;
  amount_due: number;
  already_posted: boolean;
}

export interface WorkerOverviewRow {
  worker_id: string;
  full_name: string;
  compensation_type: string;
  on_leave: boolean;
  leave_start: string | null;
  visa_issue_date: string | null;
  visa_expiry_date: string | null;
  visa_last_cost: number | null;
}

export interface VisaInput {
  visaIssueDate: string | null;
  visaExpiryDate: string | null;
  visaLastCost: number | null;
}

export interface FinancialReportAccountRow {
  account_code: string;
  account_name_ar: string;
  account_name_en: string | null;
  account_type: string;
  total: number;
}

export interface FinancialReport {
  from: string;
  to: string;
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  rows: FinancialReportAccountRow[];
}

export interface VehicleRecord {
  id: string;
  customer_id: string | null;
  plate_emirate: string;
  plate_code: string;
  plate_number: string;
  plate_country: string | null;
  is_no_plate: boolean;
  model: string | null;
  body_type: BodyType;
}

export interface CustomerRecord {
  id: string;
  phone: string;
  name: string | null;
  account_type: 'regular' | 'permanent';
}

export interface SelectedService {
  group: ServiceGroup;
  code: string;
  name: string;
  price: number;
}

export interface SubmitTransactionInput {
  phone: string;
  custName: string;
  plateEmirate: string;
  plateCode: string;
  plateNumber: string;
  plateCountry: string;
  isNoPlate: boolean;
  model: string;
  bodyType: BodyType;
  washCode: string | null; // code من WASH_OPTIONS أو null لو "بدون غسيل أساسي"
  washManualPrice: number; // يُستخدم فقط إذا كان نوع الغسيل المختار is_manual_price
  addonCodes: string[];
  addonManualPrices: { code: string; price: number }[]; // يُستخدم فقط للإضافات المفعّل لها is_manual_price
  manualEntries: { code: string; price: number }[];
  payMethod: PayMethod;
  payStatus: PayStatus;
  cardType: CardType | null;
  employeeId: string;
  notes: string;
}

export interface TransactionDetail extends SubmitTransactionInput {
  id: string;
}

export interface TransactionEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  customerName: string;
  phone: string;
  plate: string;
  model: string | null;
  employeeName: string;
  payMethod: PayMethod;
  payStatus: PayStatus;
  cardType: CardType | null;
  commissionAmount: number;
  netAmount: number;
  total: number;
  notes: string | null;
  services: { name: string; nameEn: string | null }[];
}

export interface TodaySummary {
  cash: number;
  cardGross: number;
  cardNet: number;
  cardCommission: number;
  collectedLater: number;
  collected: number;
  pending: number;
  grand: number;
}

export interface BankReconciliationResult {
  cardGrossToday: number;
  bankNet: number;
  actualCommission: number;
  actualRate: number;
}

export interface WeeklyVisitStat {
  weekStart: string; // اثنين الأسبوع (YYYY-MM-DD)
  totalVisits: number;
  uniqueCustomers: number;
  newCustomers: number; // أول زيارة لهم بالنظام كانت بهذا الأسبوع
  returningCustomers: number; // زاروا قبل هذا الأسبوع بأي وقت سابق
}

export interface MonthlyRepeatStat {
  month: string; // أول الشهر (YYYY-MM-01)
  totalVisits: number;
  uniqueCustomers: number;
  avgVisitsPerCustomer: number;
}

export interface DormantCustomer {
  customerId: string;
  name: string | null;
  phone: string;
  totalVisits: number;
  lastVisitDate: string;
  daysSinceLastVisit: number;
}

export interface LoyalCustomer {
  customerId: string;
  name: string | null;
  phone: string;
  totalVisits: number;
  lastVisitDate: string;
}

export interface NewCustomerContact {
  customerId: string;
  name: string | null;
  phone: string;
  firstVisitDate: string;
}

export interface CustomerAnalytics {
  weeklyStats: WeeklyVisitStat[];
  monthlyRepeatStats: MonthlyRepeatStat[];
  dormantSectionAvailable: boolean; // false لحد ما يمر 60 يوم من أول تسجيل فعلي بالنظام
  daysOfDataSoFar: number;
  dormantCustomers: DormantCustomer[];
  loyalCustomers: LoyalCustomer[]; // عملاء منتظمون نشطون — مرشّحون لمكافأة/تقدير للحفاظ عليهم
  newCustomersThisWeek: NewCustomerContact[]; // أول زيارة لهم وقعت بالأسبوع الحالي — مرشّحون لرسالة ترحيب
}
