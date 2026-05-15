-- ============================================================
-- Migration: public.users tablosuna balance (bakiye) kolonu ekle
-- Supabase SQL Editor'da çalıştır
-- ============================================================

-- 1. Bakiye kolonu ekle (negatif girilemesin)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS balance NUMERIC(12,2) NOT NULL DEFAULT 0.00
  CHECK (balance >= 0);

-- 2. Mevcut kullanıcılar için bakiye 0 (zaten DEFAULT ile geliyor)
-- Ekstra UPDATE gerekmez.

-- 3. Auth trigger fonksiyonunu güncelle
--    Yeni kullanıcı kaydedilince balance = 0 ile başlar.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, store_name, user_type, balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'store_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'seller'),
    0.00
  )
  ON CONFLICT (id) DO UPDATE
    SET
      store_name = EXCLUDED.store_name,
      user_type  = EXCLUDED.user_type;
      -- balance ON CONFLICT'te kasıtlı güncellenmez: mevcut bakiye korunur
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Opsiyonel: Bakiye yükleme / çekme yardımcı fonksiyonları
-- ============================================================

-- Bakiye yükle (sadece pozitif miktar)
CREATE OR REPLACE FUNCTION public.add_balance(p_user_id uuid, p_amount numeric)
RETURNS void AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Yüklenecek miktar pozitif olmalı.';
  END IF;
  UPDATE public.users
  SET balance = balance + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bakiyeden düş (yetersizse hata fırlat)
CREATE OR REPLACE FUNCTION public.deduct_balance(p_user_id uuid, p_amount numeric)
RETURNS void AS $$
DECLARE
  current_balance numeric;
BEGIN
  SELECT balance INTO current_balance FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Yetersiz bakiye. Mevcut: %, İstenen: %', current_balance, p_amount;
  END IF;
  UPDATE public.users
  SET balance = balance - p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
