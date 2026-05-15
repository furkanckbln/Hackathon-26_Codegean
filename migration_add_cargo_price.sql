-- ============================================================
-- Migration: listings tablosuna cargo_price kolonu ekle
--            + trg_order_finance_sync trigger güncelle
-- Supabase SQL Editor'da çalıştır
-- ============================================================

-- 1. Kargo fiyatı kolonu
--    > 0 : Müşteri öder (gösterilen kargo ücreti)
--    < 0 : Satıcı karşılar (abs() kadar satıcı gideri)
--    = 0 : Ücretsiz kargo (satıcı üstlenir, gider kaydı yok)
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS cargo_price NUMERIC(10,2) NOT NULL DEFAULT 29.90;

-- 2. Mevcut ilanlar için varsayılan değer zaten DEFAULT 29.90 ile geldi.

-- ============================================================
-- 3. trg_order_finance_sync trigger fonksiyonunu güncelle
--
--    Eski davranış: Her delivered/shipped sipariş için
--    order_cargo expense kaydı oluşturuyordu.
--
--    Yeni davranış:
--    • cargo_price > 0 → Müşteri öder, satıcı gideri YOK → kayıt oluşturma
--    • cargo_price < 0 → Satıcı öder → kayıt orders.py'de sipariş
--                        anında oluşturuluyor, trigger tekrar oluşturmasın
--    • cargo_price = 0 → Ücretsiz, kayıt YOK
--
--    Sonuç: order_cargo satırı trigger'dan kaldırıldı.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_order_finance_sync()
RETURNS TRIGGER AS $$
DECLARE
  seller_id uuid;
  rec_date  date;
BEGIN
  -- Yalnızca delivered veya shipped durumuna geçişte çalış
  IF NEW.status NOT IN ('delivered', 'shipped') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('delivered', 'shipped') THEN
    RETURN NEW;  -- Zaten işlendi
  END IF;

  seller_id := NEW.seller_id;
  rec_date  := COALESCE(NEW.order_date, CURRENT_DATE);

  -- ── Gelir: Brüt satış geliri ──────────────────────────────────────────────
  INSERT INTO public.finance_records
    (user_id, type, amount, category, description, record_date, source, source_order_id)
  VALUES (
    seller_id,
    'income',
    ROUND(NEW.sale_price * NEW.quantity, 2),
    'Satış Geliri',
    'Sipariş geliri — #' || NEW.id,
    rec_date,
    'order_income',
    NEW.id
  );

  -- ── Gider: Ürün maliyeti (COGS) ──────────────────────────────────────────
  IF COALESCE(NEW.cogs, 0) > 0 THEN
    INSERT INTO public.finance_records
      (user_id, type, amount, category, description, record_date, source, source_order_id)
    VALUES (
      seller_id,
      'expense',
      ROUND(NEW.cogs, 2),
      'Ürün Maliyeti',
      'Ürün maliyeti (COGS) — #' || NEW.id,
      rec_date,
      'order_cogs',
      NEW.id
    );
  END IF;

  -- ── Gider: Platform komisyonu ─────────────────────────────────────────────
  IF COALESCE(NEW.commission_amt, 0) > 0 THEN
    INSERT INTO public.finance_records
      (user_id, type, amount, category, description, record_date, source, source_order_id)
    VALUES (
      seller_id,
      'expense',
      ROUND(NEW.commission_amt, 2),
      'Platform Komisyonu',
      'Platform komisyonu (%' || ROUND(NEW.commission_rate * 100) || ') — #' || NEW.id,
      rec_date,
      'order_commission',
      NEW.id
    );
  END IF;

  -- ── Kargo: order_cargo kaydı ARTIK BURADA OLUŞTURULMUYOR ─────────────────
  -- Negatif cargo_price (satıcı öder) durumunda kayıt,
  -- sipariş oluşturulduğu anda orders.py tarafından anında yazılır.
  -- Pozitif/sıfır kargo → müşteri öder ya da ücretsiz → satıcı gideri yok.

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
