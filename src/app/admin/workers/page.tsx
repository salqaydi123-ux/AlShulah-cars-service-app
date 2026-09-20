import { getWorkersOverview } from '@/lib/actions/workers';
import AdminWorkers from '@/components/AdminWorkers';

export const dynamic = 'force-dynamic';

export default async function AdminWorkersPage() {
  const workers = await getWorkersOverview();
  return <AdminWorkers workers={workers} />;
}
