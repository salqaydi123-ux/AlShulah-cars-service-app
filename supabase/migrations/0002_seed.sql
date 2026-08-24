-- بيانات ابتدائية للإعدادات — مطابقة لقائمة الأسعار الفعلية بالنموذج التجريبي.
-- كل هذي القيم قابلة للتعديل لاحقاً من شاشة الإعدادات دون لمس الكود.

insert into wash_options (code, name, sedan_price, fourwd_price, sort_order) values
  ('wash_normal', 'غسيل عادي', 20, 25, 1),
  ('wash_full',   'غسيل كامل', 30, 35, 2),
  ('wash_diesel', 'غسيل كامل + رش ديزل (أسفل السيارة والمكينة)', 40, 45, 3),
  ('wash_chem',   'غسيل بالمادة الكيميائية', 90, 100, 4),
  ('wash_steam',  'غسيل بخار بالمادة الكيميائية', 130, 150, 5);

insert into addon_services (code, name, price, sort_order) values
  ('engine_clean', 'غسيل مكينة', 50, 1),
  ('wheel_clean',  'غسيل رنجات', 50, 2);

insert into manual_services (code, name, hint, sort_order) values
  ('internal', 'تنظيف داخلي', 'إرشادي: سيدان 250 / فورويل 300 / فورويل كبير (جمس وأمثالها) 350', 1),
  ('polish',   'تلميع السيارة', null, 2),
  ('tint',     'تظليل الزجاج (زينة السيارات)', null, 3),
  ('oil',      'تغيير زيت السيارة', null, 4);

insert into card_commission_rates (card_type, label, rate_percent) values
  ('debit',  'مدى / خصم مباشر', 1.0),
  ('credit', 'فيزا / ماستركارد ائتمان', 2.5),
  ('amex',   'أمريكان إكسبريس', 3.5);

insert into employees (name, sort_order)
select 'موظف ' || i, i from generate_series(1, 12) as i;

insert into app_settings (key, value) values
  ('bank_monthly_maintenance_fee', '{"amount": 0, "note": "رسوم الصيانة الشهرية الثابتة للحساب البنكي — عدّلها من الإعدادات"}');
