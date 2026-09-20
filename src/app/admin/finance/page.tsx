import { getExpenseAccounts, getPayrollMonths } from '@/lib/actions/accounting';
import AdminFinance from '@/components/AdminFinance';

export const dynamic = 'force-dynamic';

function lastTwelveMonthStarts(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`);
  }
  return months;
}

export default async function AdminFinancePage() {
  const [expenseAccounts, payrollMonths] = await Promise.all([getExpenseAccounts(), getPayrollMonths()]);
  return <AdminFinance expenseAccounts={expenseAccounts} expenseMonths={lastTwelveMonthStarts()} payrollMonths={payrollMonths} />;
}
