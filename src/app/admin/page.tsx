import { getAdminConfig } from '@/lib/actions/settings';
import AdminSettings from '@/components/AdminSettings';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const config = await getAdminConfig();
  return <AdminSettings config={config} />;
}
