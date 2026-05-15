-- ============================================================
-- Migration: public.users tablosuna user_type kolonu ekle
-- Supabase SQL Editor'da çalıştır
-- ============================================================

-- 1. Kolonu ekle (CHECK constraint ile değer kısıtı)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'seller'
  CHECK (user_type IN ('seller', 'customer'));

-- 2. Mevcut kullanıcılar zaten satıcı panelinden kayıt oldu → 'seller'
UPDATE public.users
SET user_type = 'seller'
WHERE user_type IS NULL OR user_type = '';

-- 3. Auth trigger fonksiyonunu güncelle
--    Yeni kullanıcı auth.users'a eklenince public.users'a da ekler.
--    user_type artık raw_user_meta_data'dan okunuyor.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, store_name, user_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'store_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'seller')
  )
  ON CONFLICT (id) DO UPDATE
    SET
      store_name = EXCLUDED.store_name,
      user_type  = EXCLUDED.user_type;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
