-- ============================================================
-- Trigger: trg_order_stock_decrement
-- Tetikleyici: orders tablosuna her INSERT'te çalışır
-- Görev:
--   1. listings.stock  → quantity kadar azalt (min 0)
--   2. listings.sales_count → quantity kadar artır
-- ============================================================

CREATE OR REPLACE FUNCTION fn_decrease_stock_on_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Stok yeterliliği kontrolü
  IF (SELECT stock FROM listings WHERE id = NEW.listing_id) < NEW.quantity THEN
    RAISE EXCEPTION 'Yetersiz stok: listing_id=%, stok=%, istek=%',
      NEW.listing_id,
      (SELECT stock FROM listings WHERE id = NEW.listing_id),
      NEW.quantity;
  END IF;

  -- Stoku düşür, satış adedini artır
  UPDATE listings
  SET
    stock       = GREATEST(stock - NEW.quantity, 0),
    sales_count = COALESCE(sales_count, 0) + NEW.quantity
  WHERE id = NEW.listing_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Varsa önceki trigger'ı temizle
DROP TRIGGER IF EXISTS trg_order_stock_decrement ON orders;

-- Trigger'ı bağla
CREATE TRIGGER trg_order_stock_decrement
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_decrease_stock_on_order();
