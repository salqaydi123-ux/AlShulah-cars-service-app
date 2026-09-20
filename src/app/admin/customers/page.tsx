import { getCustomerAnalytics } from '@/lib/actions/customers';
import AdminCustomers from '@/components/AdminCustomers';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage() {
  const analytics = await getCustomerAnalytics();
  return <AdminCustomers analytics={analytics} />;
}
