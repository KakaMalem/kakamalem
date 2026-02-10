-- Seed marketplace categories for the store-directory marketplace
-- Afghan market-relevant categories with Dari (name_fa) translations and emoji icons

INSERT INTO marketplace_categories (slug, name, name_fa, name_ps, icon, display_order) VALUES
  ('clothing', 'Clothing & Fashion', 'لباس و مد', 'کالي او فیشن', '👗', 1),
  ('electronics', 'Electronics & Tech', 'الکترونیک و تکنالوژی', 'بریښنایي او ټکنالوژي', '📱', 2),
  ('food', 'Food & Groceries', 'غذا و مواد غذایی', 'خواړه او پرچون', '🍎', 3),
  ('handmade', 'Handmade & Crafts', 'صنایع دستی', 'لاسي صنایع', '🧶', 4),
  ('home', 'Home & Living', 'خانه و زندگی', 'کور او ژوند', '🏠', 5),
  ('beauty', 'Beauty & Personal Care', 'زیبایی و بهداشت', 'ښکلا او روغتیا', '💄', 6),
  ('jewelry', 'Jewelry & Accessories', 'جواهرات و زیورآلات', 'غمی او زیورات', '💎', 7),
  ('books', 'Books & Stationery', 'کتاب و لوازم تحریر', 'کتابونه او لوازم', '📚', 8),
  ('sports', 'Sports & Outdoors', 'ورزش و فضای باز', 'سپورت او تفریح', '⚽', 9),
  ('automotive', 'Automotive & Parts', 'خودرو و قطعات', 'موټر او پرزې', '🚗', 10),
  ('kids', 'Kids & Baby', 'کودک و نوزاد', 'ماشومان او نوزاد', '🧸', 11),
  ('services', 'Services', 'خدمات', 'خدمات', '🔧', 12)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  name_fa = EXCLUDED.name_fa,
  name_ps = EXCLUDED.name_ps,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order;
