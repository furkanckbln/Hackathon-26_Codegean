"""
rembg Servisi — Arka Plan Temizleme

Görev:
  Yüklenen ürün görselini rembg kütüphanesiyle işle,
  şeffaf arka planlı PNG üret.

  YOLO'nun aksine rembg kategori bağımsız çalışır — ürünün ne olduğunu
  bilmeden foreground/background ayrımı yapar. E-ticaret ürün fotoğrafları
  için U2-Net tabanlı bu yaklaşım çok daha güvenilir sonuç verir.

Not: İlk çalıştırmada model ağırlıkları otomatik indirilir (~170MB),
     sonraki çalıştırmalarda cache'den gelir.
"""

import io
from PIL import Image
from rembg import remove, new_session

# ── Oturum tek sefer oluşturulur (singleton) ────────────────────────────────
# u2net modeli genel amaçlı, ürün fotoğrafları için yeterince güçlü.
# Alternatif: "u2net_human_seg" (insan), "isnet-general-use" (daha doğru ama yavaş)
_session = None

def get_session():
    global _session
    if _session is None:
        _session = new_session("u2netp")
    return _session


def remove_background(image_bytes: bytes) -> bytes:
    """
    Görsel byte'larını alır, şeffaf arka planlı PNG döndürür.

    Args:
        image_bytes: Ham görsel verisi (JPG, PNG, WEBP vb.)

    Returns:
        clean_png: bytes — şeffaf arka planlı PNG
    """
    session = get_session()

    # rembg direkt bytes alıp bytes döndürür
    output_bytes = remove(image_bytes, session=session)

    # Pillow üzerinden geçirerek PNG formatını garantile
    img = Image.open(io.BytesIO(output_bytes)).convert("RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    buf.seek(0)

    return buf.getvalue()
