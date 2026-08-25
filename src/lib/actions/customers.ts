'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

export interface CustomerExportRow {
  phone: string;
  name: string | null;
  visits: number;
  lastVisitDate: string | null;
}

export async function getCustomerExportRows(): Promise<CustomerExportRow[]> {
  const db = supabaseAdmin();

  const { data: customers, error: custErr } = await db.from('customers').select('id, phone, name');
  if (custErr) throw new Error(custErr.message);

  const { data: transactions, error: txErr } = await db.from('transactions').select('customer_id, tx_date');
  if (txErr) throw new Error(txErr.message);

  const stats = new Map<string, { visits: number; lastVisitDate: string | null }>();
  for (const tx of transactions ?? []) {
    const s = stats.get(tx.customer_id) || { visits: 0, lastVisitDate: null };
    s.visits += 1;
    if (!s.lastVisitDate || tx.tx_date > s.lastVisitDate) s.lastVisitDate = tx.tx_date;
    stats.set(tx.customer_id, s);
  }

  return (customers ?? [])
    .map((c) => {
      const s = stats.get(c.id) || { visits: 0, lastVisitDate: null };
      return { phone: c.phone, name: c.name, visits: s.visits, lastVisitDate: s.lastVisitDate };
    })
    .sort((a, b) => (b.lastVisitDate || '').localeCompare(a.lastVisitDate || ''));
}
