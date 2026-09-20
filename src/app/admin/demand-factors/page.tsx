import { getBusinessFactors } from '@/lib/actions/demandFactors';
import AdminDemandFactors from '@/components/AdminDemandFactors';

export const dynamic = 'force-dynamic';

export default async function AdminDemandFactorsPage() {
  const factors = await getBusinessFactors();
  return <AdminDemandFactors initialFactors={factors} />;
}
