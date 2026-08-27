-- بعض أنواع الغسيل الأساسي (رش الديزل، الكيميائي، البخار الكيميائي) يتفاوت سعرها الفعلي
-- حسب حالة/حجم السيارة أكثر من باقي الأنواع، فنسمح بإدخال سعرها يدوياً بكل عملية
-- بدل الاعتماد على السعر الثابت حسب نوع الهيكل — مع بقاء "غسيل أساسي واحد فقط لكل عملية".

alter table wash_options add column is_manual_price boolean not null default false;

update wash_options set is_manual_price = true
  where code in ('wash_diesel', 'wash_chem', 'wash_steam') and is_current;
