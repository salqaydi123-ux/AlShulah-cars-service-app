-- يسمح بإضافة خدمة حرة (اسم + سعر يُكتبان يدوياً بالكامل، بدون ربط بكتالوج الخدمات) لكل عملية،
-- لخدمات نادرة/استثنائية ما تستاهل إضافتها كخدمة دائمة بالإعدادات.

alter table transaction_services drop constraint transaction_services_service_group_check;
alter table transaction_services add constraint transaction_services_service_group_check
  check (service_group in ('wash', 'addon', 'manual', 'custom'));
