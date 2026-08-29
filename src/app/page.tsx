import { getFormConfig } from '@/lib/actions/lookup';
import { getReconciliationForDate, getServerTodayDate, getTodaySummary, listToday } from '@/lib/actions/transactions';
import DailyEntryApp from '@/components/DailyEntryApp';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const todayDate = await getServerTodayDate();

  const [config, todayEntries, summary, reconciliation] = await Promise.all([
    getFormConfig(),
    listToday(),
    getTodaySummary(),
    getReconciliationForDate(todayDate),
  ]);

  return (
    <DailyEntryApp
      config={config}
      initialEntries={todayEntries}
      initialSummary={summary}
      initialReconciliation={reconciliation}
      todayDate={todayDate}
    />
  );
}
