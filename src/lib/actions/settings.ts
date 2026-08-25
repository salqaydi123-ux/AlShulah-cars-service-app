'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { CardType } from '@/lib/types';

// نمط "الإعداد النسخّي": أي تعديل = إغلاق السجل الحالي (is_current=false, valid_to=now)
// ثم إدخال سجل جديد is_current=true. العمليات القديمة تبقى مرتبطة بلقطتها (snapshot) الخاصة بوقتها،
// ولا تتأثر إطلاقاً بهذا التعديل لأنها لا تقرأ من هذي الجداول بعد لحظة التنفيذ.
async function closeCurrentRow(table: string, matchColumn: string, matchValue: string) {
  const db = supabaseAdmin();
  const { error } = await db
    .from(table)
    .update({ is_current: false, valid_to: new Date().toISOString() })
    .eq(matchColumn, matchValue)
    .eq('is_current', true);
  if (error) throw new Error(error.message);
}

export interface WashOptionInput {
  code: string;
  name: string;
  nameEn: string;
  sedanPrice: number;
  fourwdPrice: number;
  sortOrder: number;
}

export async function upsertWashOption(input: WashOptionInput) {
  const db = supabaseAdmin();
  await closeCurrentRow('wash_options', 'code', input.code);
  const { error } = await db.from('wash_options').insert({
    code: input.code,
    name: input.name,
    name_en: input.nameEn.trim() || null,
    sedan_price: input.sedanPrice,
    fourwd_price: input.fourwdPrice,
    sort_order: input.sortOrder,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export interface AddonServiceInput {
  code: string;
  name: string;
  nameEn: string;
  price: number;
  sortOrder: number;
}

export async function upsertAddonService(input: AddonServiceInput) {
  const db = supabaseAdmin();
  await closeCurrentRow('addon_services', 'code', input.code);
  const { error } = await db.from('addon_services').insert({
    code: input.code,
    name: input.name,
    name_en: input.nameEn.trim() || null,
    price: input.price,
    sort_order: input.sortOrder,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export interface ManualServiceInput {
  code: string;
  name: string;
  nameEn: string;
  hint: string;
  hintEn: string;
  sortOrder: number;
}

export async function upsertManualService(input: ManualServiceInput) {
  const db = supabaseAdmin();
  await closeCurrentRow('manual_services', 'code', input.code);
  const { error } = await db.from('manual_services').insert({
    code: input.code,
    name: input.name,
    name_en: input.nameEn.trim() || null,
    hint: input.hint || null,
    hint_en: input.hintEn.trim() || null,
    sort_order: input.sortOrder,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export interface CardRateInput {
  cardType: CardType;
  label: string;
  labelEn: string;
  ratePercent: number;
}

export async function upsertCardRate(input: CardRateInput) {
  const db = supabaseAdmin();
  await closeCurrentRow('card_commission_rates', 'card_type', input.cardType);
  const { error } = await db.from('card_commission_rates').insert({
    card_type: input.cardType,
    label: input.label,
    label_en: input.labelEn.trim() || null,
    rate_percent: input.ratePercent,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function addEmployee(name: string) {
  const db = supabaseAdmin();
  const { data, error: countErr } = await db.from('employees').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  if (countErr) throw new Error(countErr.message);
  const nextOrder = (data?.[0]?.sort_order ?? 0) + 1;
  const { error } = await db.from('employees').insert({ name: name.trim(), sort_order: nextOrder });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function renameEmployee(id: string, name: string) {
  const db = supabaseAdmin();
  const { error } = await db.from('employees').update({ name: name.trim() }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function setEmployeeActive(id: string, active: boolean) {
  const db = supabaseAdmin();
  const { error } = await db.from('employees').update({ active }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/');
}

export interface AdminConfigSnapshot {
  washOptions: { id: string; code: string; name: string; name_en: string | null; sedan_price: number; fourwd_price: number; sort_order: number }[];
  addonServices: { id: string; code: string; name: string; name_en: string | null; price: number; sort_order: number }[];
  manualServices: { id: string; code: string; name: string; name_en: string | null; hint: string | null; hint_en: string | null; sort_order: number }[];
  cardRates: { id: string; card_type: string; label: string; label_en: string | null; rate_percent: number }[];
  employees: { id: string; name: string; active: boolean; sort_order: number }[];
}

export async function getAdminConfig(): Promise<AdminConfigSnapshot> {
  const db = supabaseAdmin();
  const [wash, addons, manual, cards, employees] = await Promise.all([
    db.from('wash_options').select('*').eq('is_current', true).order('sort_order'),
    db.from('addon_services').select('*').eq('is_current', true).order('sort_order'),
    db.from('manual_services').select('*').eq('is_current', true).order('sort_order'),
    db.from('card_commission_rates').select('*').eq('is_current', true),
    db.from('employees').select('*').order('sort_order'),
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
