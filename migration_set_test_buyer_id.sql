-- ============================================================
-- Test: orders tablosundaki tüm kayıtlara buyer_id ata
-- Supabase SQL Editor'da çalıştır
-- ============================================================

UPDATE public.orders
SET buyer_id = 'ad320cc1-f2e5-42ea-954f-d75c7ac0eef1'
WHERE buyer_id IS NULL;
