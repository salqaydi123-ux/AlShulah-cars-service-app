-- إضافات الغسيل (غسيل مكينة / غسيل رنجات) يتفاوت سعرها الفعلي حسب حجم/حالة السيارة،
-- فنسمح بإدخال سعرها يدوياً بكل عملية بدل السعر الثابت — نفس مبدأ wash_options.is_manual_price.

alter table addon_services add column is_manual_price boolean not null default false;

update addon_services set is_manual_price = true
  where code in ('engine_clean', 'wheel_clean') and is_current;
