'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { CustomerRecord, FormConfig, VehicleRecord } from '@/lib/types';

export async function getFormConfig(): Promise<FormConfig> {
  const db = supabaseAdmin();

  const [wash, addons, manual, cards, employees] = await Promise.all([
    db.from('wash_options').select('*').eq('is_current', true).order('sort_order'),
    db.from('addon_services').select('*').eq('is_current', true).order('sort_order'),
    db.from('manual_services').select('*').eq('is_current', true).order('sort_order'),
    db.from('card_commission_rates').select('*').eq('is_current', true),
    db.from('employees').select('*').eq('active', true).order('sort_order'),
  ]);

  for (const r of [wash, addons, manual, cards, employees]) {
    if (r.error) throw new Error(r.error.message);
  }

  return {
    washOptions: wash.data ?? [],
    addonServices: addons.data ?? [],
    manualServices: manual.data ?? [],
    cardRates: cards.data ?? [],
    employees: employees.data ?? [],
  };
}

export interface PhoneSearchResult {
  customer: CustomerRecord | null;
  vehicles: VehicleRecord[];
}

export async function searchByPhone(phoneRaw: string): Promise<PhoneSearchResult> {
  const phone = phoneRaw.trim();
  const db = supabaseAdmin();

  const { data: customer, error: custErr } = await db
    .from('customers')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();
  if (custErr) throw new Error(custErr.message);

  if (!customer) return { customer: null, vehicles: [] };

  const { data: vehicles, error: vehErr } = await db
    .from('vehicles')
    .select('*')
    .eq('customer_id', customer.id)
    .eq('is_no_plate', false)
    .order('updated_at', { ascending: false });
  if (vehErr) throw new Error(vehErr.message);

  return { customer, vehicles: vehicles ?? [] };
}

export interface PlateSearchInput {
  plateEmirate: string;
  plateCode: string;
  plateNumber: string;
  plateCountry: string;
}

export interface PlateSearchResult {
  vehicle: VehicleRecord | null;
  customer: CustomerRecord | null;
}

export async function searchByPlate(input: PlateSearchInput): Promise<PlateSearchResult> {
  const db = supabaseAdmin();
  const code = input.plateCode.trim();
  const number = input.plateNumber.trim();
  const country = input.plateEmirate === 'other' ? input.plateCountry.trim() : '';

  if (!number) return { vehicle: null, customer: null };

  let query = db
    .from('vehicles')
    .select('*')
    .eq('plate_emirate', input.plateEmirate)
    .eq('plate_code', code)
    .eq('plate_number', number)
    .eq('is_no_plate', false);

  query = input.plateEmirate === 'other' ? query.eq('plate_country', country) : query.is('plate_country', null);

  const { data: vehicle, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!vehicle) return { vehicle: null, customer: null };

  let customer: CustomerRecord | null = null;
  if (vehicle.customer_id) {
    const { data, error: custErr } = await db
      .from('customers')
      .select('*')
      .eq('id', vehicle.customer_id)
      .maybeSingle();
    if (custErr) throw new Error(custErr.message);
    customer = data;
  }

  return { vehicle, customer };
}
