-- دعم اللغة الإنجليزية بجانب العربية — أسماء الخدمات وملاحظاتها الإرشادية
-- تصير قابلة لإدخال نسخة إنجليزية اختيارية من الإعدادات، تُعرض للعمال الذين لا يقرؤون العربية.
-- نُبقي name/hint/label العربية كحقول أساسية إلزامية، ونضيف نسخة _en اختيارية بجانبها.

alter table wash_options add column name_en text;
alter table addon_services add column name_en text;
alter table manual_services add column name_en text;
alter table manual_services add column hint_en text;
alter table card_commission_rates add column label_en text;

-- لقطة الاسم الإنجليزي وقت تنفيذ العملية (نفس مبدأ service_name العربي) — حتى لا تتأثر السجلات القديمة بتعديل لاحق
alter table transaction_services add column service_name_en text;

-- تعبئة الترجمات الابتدائية المطابقة للأسعار الحالية (قابلة للتعديل لاحقاً من شاشة الإعدادات)
update wash_options set name_en = 'Regular Wash' where code = 'wash_normal' and is_current;
update wash_options set name_en = 'Full Wash' where code = 'wash_full' and is_current;
update wash_options set name_en = 'Full Wash + Diesel Spray (underbody & engine)' where code = 'wash_diesel' and is_current;
update wash_options set name_en = 'Chemical Wash' where code = 'wash_chem' and is_current;
update wash_options set name_en = 'Steam Chemical Wash' where code = 'wash_steam' and is_current;

update addon_services set name_en = 'Engine Wash' where code = 'engine_clean' and is_current;
update addon_services set name_en = 'Wheel/Rim Wash' where code = 'wheel_clean' and is_current;

update manual_services set name_en = 'Interior Cleaning', hint_en = 'Guideline: Sedan 250 / SUV 300 / Large SUV (e.g. GMC) 350'
  where code = 'internal' and is_current;
update manual_services set name_en = 'Car Polish' where code = 'polish' and is_current;
update manual_services set name_en = 'Window Tinting (Car Accessories)' where code = 'tint' and is_current;
update manual_services set name_en = 'Oil Change' where code = 'oil' and is_current;

update card_commission_rates set label_en = 'Mada / Direct Debit' where card_type = 'debit' and is_current;
update card_commission_rates set label_en = 'Visa / Mastercard Credit' where card_type = 'credit' and is_current;
update card_commission_rates set label_en = 'American Express' where card_type = 'amex' and is_current;
