import { getFormConfig } from '@/lib/actions/lookup';
import { getTodayReconciliation, getTodaySummary, listToday } from '@/lib/actions/transactions';
import DailyEntryApp from '@/components/DailyEntryApp';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [config, todayEntries, summary, reconciliation] = await Promise.all([
    getFormConfig(),
    listToday(),
    getTodaySummary(),
    getTodayReconciliation(),
  ]);

  return (
    <DailyEntryApp
      config={config}
      initialEntries={todayEntries}
      initialSummary={summary}
      initialReconciliation={reconciliation}
    />
  );
}
