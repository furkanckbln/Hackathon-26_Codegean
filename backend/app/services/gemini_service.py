"""
Gemini Servisi — İlan İçeriği Üretimi & Chat Asistanı

Senkron requests kütüphanesi kullanılıyor.
google-genai / google-generativeai SDK'larının Windows'ta
asyncio DNS katmanında yaşattığı bağlantı sorununu bu yaklaşım çözüyor.
Router'dan asyncio.to_thread() ile çağrılır.

Fonksiyonlar:
  generate_listing_content() → Görsel + bilgilerden ilan metni üretir
  chat_edit_listing()        → Satıcının prompt'una göre ilan içeriğini düzenler
"""

import os
import json
import base64
import requests
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL   = "gemini-2.5-flash"
GEMINI_URL     = (
    f"https://generativelanguage.googleapis.com/v1beta/models"
    f"/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
)

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY .env dosyasında tanımlı değil!")

# ── Sabit Kategori Listesi ───────────────────────────────────────────────────
CATEGORIES = [
    # Elektronik
    "Telefon & Aksesuar",
    "Bilgisayar & Tablet",
    "TV & Görüntü Sistemleri",
    "Ses & Müzik Sistemleri",
    "Fotoğraf & Kamera",
    "Oyun & Konsol",
    "Küçük Ev Aletleri",
    "Beyaz Eşya",
    # Giyim & Aksesuar
    "Kadın Giyim",
    "Erkek Giyim",
    "Çocuk Giyim",
    "Ayakkabı",
    "Çanta & Cüzdan",
    "Takı & Mücevher",
    "Saat",
    "Gözlük & Aksesuar",
    # Ev & Yaşam
    "Mobilya",
    "Ev Tekstili",
    "Mutfak & Yemek",
    "Dekorasyon",
    "Aydınlatma",
    "Banyo & Kişisel Bakım Ürünleri",
    "Temizlik & Hijyen",
    # Spor & Outdoor
    "Spor Giyim & Ayakkabı",
    "Spor Ekipmanları & Aletleri",
    "Outdoor & Kamp",
    "Bisiklet & Scooter",
    "Fitness & Wellness",
    # Kozmetik & Güzellik
    "Parfüm & Deodorant",
    "Cilt Bakımı",
    "Saç Bakımı & Şekillendirme",
    "Makyaj & Kozmetik",
    # Anne & Bebek
    "Bebek Giyim",
    "Bebek Bakım & Beslenme",
    "Oyuncak & Oyun",
    # Kitap, Film & Müzik
    "Kitap",
    "Film & Müzik",
    # Otomotiv
    "Otomotiv Aksesuar",
    "Otomotiv Yedek Parça",
    # Bahçe & Yapı
    "Bahçe & Tarım",
    "El Aletleri & Hırdavat",
    "Yapı Malzemeleri",
    # Gıda
    "Gıda & İçecek",
    # Sağlık
    "Vitamin & Gıda Takviyesi",
    "Medikal & Sağlık Ürünleri",
    # Diğer
    "Kırtasiye & Ofis",
    "Evcil Hayvan Ürünleri",
    "Diğer",
]

# ── Ton açıklamaları ─────────────────────────────────────────────────────────
TONE_DESC = {
    "professional": "Kurumsal, güven veren, teknik detaylara odaklanan bir dil kullan.",
    "friendly":     "Samimi, sıcak ve müşteriyle doğrudan konuşan (sen dili) bir dil kullan.",
    "youth":        "Enerjik, güncel ve dinamik bir dil kullan, uygun yerlerde emoji ekleyebilirsin 🔥",
}


# ── Yardımcı fonksiyonlar ────────────────────────────────────────────────────
def _fetch_image_b64(url: str) -> tuple[str, str]:
    """URL'den görseli indirir, base64'e çevirir. (sync)"""
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    content_type = resp.headers.get("content-type", "image/png").split(";")[0].strip()
    b64 = base64.b64encode(resp.content).decode("utf-8")
    return b64, content_type


def _gemini_post(payload: dict) -> dict:
    """Gemini REST API'ye POST atar. (sync)"""
    resp = requests.post(
        GEMINI_URL,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=60,
    )
    if not resp.ok:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        raise ValueError(f"Gemini API {resp.status_code}: {detail}")
    return resp.json()


def _extract_text(raw: dict) -> str:
    """API yanıtından metin kısmını çıkarır."""
    try:
        return raw["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise ValueError(f"Gemini yanıtı beklenmedik formatta: {e}\n{raw}")


def _clean_json_text(text: str) -> str:
    """Gemini bazen ```json ... ``` bloğu içinde döndürür, temizle."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
    return text.strip()


def _build_listing_prompt(brand: str, price: str, tone: str, extra_note: str) -> str:
    tone_desc    = TONE_DESC.get(tone, TONE_DESC["professional"])
    brand_str    = f"Marka    : {brand}" if brand else "Marka    : Belirtilmemiş"
    price_str    = f"Fiyat    : {price} TL" if price else "Fiyat    : Belirtilmemiş"
    note_str     = f"\nEk Not   : {extra_note}" if extra_note else ""
    category_list = "\n".join(f"  - {c}" for c in CATEGORIES)

    return f"""Sen deneyimli bir Türk e-ticaret ilan uzmanısın.
Görseldeki ürünü dikkatlice incele, kategorisini belirle ve ilan içeriği oluştur.
Yanıtını YALNIZCA geçerli JSON olarak döndür, başka hiçbir şey yazma.

{brand_str}
{price_str}
Ton      : {tone_desc}{note_str}

KATEGORİ KURALI:
Aşağıdaki listeden YALNIZCA BİRİNİ seç, listedeki metni birebir yaz, değiştirme:
{category_list}

JSON formatı:
{{
  "category"   : "Yukarıdaki listeden seçilen kategori (birebir aynı yazım)",
  "title"      : "max 80 karakter, marka + ürün adı + öne çıkan özellik",
  "short_desc" : "tek cümle, max 150 karakter, ürünün en güçlü yönü",
  "long_desc"  : "2-3 paragraf, 250-400 karakter, kullanım alanı + malzeme + avantaj",
  "features"   : ["özellik 1", "özellik 2", "özellik 3", "özellik 4", "özellik 5"],
  "seo_tags"   : ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"]
}}"""


def _validate_response(data: dict) -> list[str]:
    """Eksik, boş veya geçersiz alanları kontrol et."""
    required = ["category", "title", "short_desc", "long_desc", "features", "seo_tags"]
    problems = []
    for field in required:
        val = data.get(field)
        if not val:
            problems.append(field)
        elif isinstance(val, list) and len(val) == 0:
            problems.append(field)
        elif isinstance(val, str) and val.strip() == "":
            problems.append(field)

    # Kategori listede yoksa geçersiz say
    category = data.get("category", "")
    if category and category not in CATEGORIES:
        # En yakın eşleşmeyi bulmaya çalış (büyük/küçük harf toleransı)
        normalized = {c.lower(): c for c in CATEGORIES}
        match = normalized.get(category.lower())
        if match:
            data["category"] = match   # sessizce düzelt
        else:
            if "category" not in problems:
                problems.append("category")

    return problems


# ── Ana fonksiyon: İlan içeriği üret (SYNC) ─────────────────────────────────
def generate_listing_content(
    image_url:   str,
    tone:        str,
    brand:       str = "",
    price:       str = "",
    extra_note:  str = "",
    max_retries: int = 2,
) -> dict:
    """
    Gemini Vision ile ilan içeriği üretir. (senkron)
    Kategori de Gemini tarafından görselden tespit edilir.
    Router'dan asyncio.to_thread() ile çağrılır.

    Returns:
        {category, title, short_desc, long_desc, features (str), seo_tags (str)}
    """
    image_b64, mime_type = _fetch_image_b64(image_url)
    prompt = _build_listing_prompt(brand, price, tone, extra_note)

    data = {}

    for attempt in range(max_retries + 1):
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": image_b64,
                            }
                        },
                        {"text": prompt},
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.7,
            },
        }

        raw  = _gemini_post(payload)
        text = _clean_json_text(_extract_text(raw))

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            if attempt < max_retries:
                continue
            raise ValueError(f"Gemini geçerli JSON döndürmedi: {text[:200]}")

        # Agent 4 — Alan doluluk kontrolü
        problems = _validate_response(data)
        if not problems:
            break

        if attempt < max_retries:
            prompt += f"\n\nÖNCEKİ YANINDA ŞU ALANLAR BOŞTU, MUTLAKA DOLDUR: {', '.join(problems)}"

    features = data.get("features", [])
    seo_tags = data.get("seo_tags", [])

    return {
        "category":   data.get("category", ""),
        "title":      data.get("title", ""),
        "short_desc": data.get("short_desc", ""),
        "long_desc":  data.get("long_desc", ""),
        "features":   "\n".join(features) if isinstance(features, list) else features,
        "seo_tags":   ", ".join(seo_tags)  if isinstance(seo_tags,  list) else seo_tags,
    }


# ── Chat asistanı: İlan içeriğini düzenle (SYNC) ────────────────────────────
def chat_edit_listing(
    user_message: str,
    current_form: dict,
    category:     str,
    tone:         str,
) -> dict:
    """
    Satıcının doğal dil isteğine göre mevcut ilan içeriğini düzenler. (senkron)
    Router'dan asyncio.to_thread() ile çağrılır.

    Returns:
        {updated_form: dict, reply: str}
    """
    tone_desc = TONE_DESC.get(tone, TONE_DESC["professional"])

    prompt = f"""Sen bir e-ticaret ilan düzenleme asistanısın.
Aşağıda mevcut bir ilanın içeriği ve satıcının değişiklik isteği var.
İstenen değişikliği yap ve YALNIZCA güncellenmiş alanları JSON olarak döndür.
Yanıtını YALNIZCA geçerli JSON olarak döndür, başka hiçbir şey yazma.

MEVCUT İLAN:
Başlık         : {current_form.get('title', '')}
Kısa Açıklama  : {current_form.get('shortDesc', '')}
Uzun Açıklama  : {current_form.get('longDesc', '')}
Özellikler     : {current_form.get('features', '')}
SEO Etiketleri : {current_form.get('seoTags', '')}
Kategori       : {category}
Ton            : {tone_desc}

SATICININ İSTEĞİ: {user_message}

JSON formatı:
{{
  "title"      : "güncellendiyse yeni değer, aksi halde null",
  "short_desc" : "güncellendiyse yeni değer, aksi halde null",
  "long_desc"  : "güncellendiyse yeni değer, aksi halde null",
  "features"   : "güncellendiyse yeni değer (satır satır), aksi halde null",
  "seo_tags"   : "güncellendiyse yeni değer (virgülle), aksi halde null",
  "reply"      : "satıcıya ne yaptığını anlatan kısa Türkçe mesaj (max 100 karakter)"
}}"""

    payload = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.5,
        },
    }

    try:
        raw  = _gemini_post(payload)
        text = _clean_json_text(_extract_text(raw))
        data = json.loads(text)
    except Exception:
        return {
            "updated_form": {},
            "reply": "İsteğini anlayamadım, tekrar dener misin?"
        }

    reply        = data.pop("reply", "✅ Güncellendi.")
    updated_form = {k: v for k, v in data.items() if v is not None}

    return {
        "updated_form": updated_form,
        "reply": reply,
    }


# ── Satış Asistanı Chat (SYNC) ───────────────────────────────────────────────
def sales_assistant_chat(
    message: str,
    history: list,
    context: dict,
) -> str:
    """
    Satış asistanı sohbet fonksiyonu. (senkron)
    Router'dan asyncio.to_thread() ile çağrılır.

    Args:
        message : Kullanıcının yeni mesajı
        history : [{"role": "user"|"ai", "text": "..."}] — son 10 mesaj
        context : summary endpoint'inden gelen veri sözlüğü

    Returns:
        Asistanın yanıt metni
    """

    # ── Bağlam verisini okunabilir metne çevir ───────────────────────────────
    my_stats     = context.get("my_stats", {})
    top_listings = context.get("top_listings", [])
    low_stock    = context.get("low_stock", [])
    category_avgs = context.get("category_avgs", {})
    top_sector   = context.get("top_sector", [])

    top_listings_text = "\n".join([
        f"  - {l['title']} → {l.get('sales_count', 0)} satış, "
        f"puan: {l.get('rating') or 'yok'}, fiyat: {l.get('price', '?')}₺"
        for l in top_listings
    ]) or "  Henüz satış verisi yok."

    low_stock_text = "\n".join([
        f"  - {l['title']} → {l.get('stock', 0)} adet kaldı"
        for l in low_stock
    ]) or "  Stok uyarısı yok."

    top_sector_text = "\n".join([
        f"  - {l['title']} ({l.get('category', '?')}) → "
        f"{l.get('sales_count', 0)} satış, {l.get('price', '?')}₺"
        for l in top_sector
    ]) or "  Veri yok."

    category_text = "\n".join([
        f"  - {cat}: ort. fiyat {d.get('avg_price') or '?'}₺, "
        f"ort. satış {d.get('avg_sales') or '?'}, "
        f"ort. puan {d.get('avg_rating') or '?'}, "
        f"{d.get('listing_count', 0)} ilan"
        for cat, d in list(category_avgs.items())[:10]
    ]) or "  Veri yok."

    system_prompt = f"""Sen SellerAI platformunun deneyimli bir e-ticaret satış asistanısın.
Türk KOBİ satıcılarına ilanlarını iyileştirme, fiyatlandırma ve sektör trendleri konusunda somut, \
veri odaklı öneriler sunuyorsun. Her zaman Türkçe yanıt ver. Kısa ve net ol, gereksiz giriş cümleleri kurma.

━━━ SATICININ MEVCUT VERİLERİ ━━━

GENEL DURUM:
  Toplam ilan: {my_stats.get('total_listings', 0)}
  Aktif ilan:  {my_stats.get('active_listings', 0)}
  Toplam satış: {my_stats.get('total_sales', 0)}
  Ortalama puan: {my_stats.get('avg_rating') or 'henüz yok'}

EN ÇOK SATAN İLANLARI:
{top_listings_text}

STOK UYARILARI (stok <= 5):
{low_stock_text}

━━━ SEKTÖR VERİLERİ ━━━

PLATFORMUN EN ÇOK SATANLARI:
{top_sector_text}

KATEGORİ ORTALIMALARI:
{category_text}

━━━ GÖREV ━━━
Satıcının sorularını yukarıdaki verilere dayanarak yanıtla.
Karşılaştırma yapabiliyorsan rakamları kullan.
Öneri veriyorsan somut ve uygulanabilir ol."""

    # ── Gemini contents dizisini oluştur ─────────────────────────────────────
    # İlk eleman: sistem promptunu user mesajı olarak gönder (REST API'de system role yok)
    contents = [
        {"role": "user",  "parts": [{"text": system_prompt}]},
        {"role": "model", "parts": [{"text": "Anladım. Satış verilerini inceledim, soruların için hazırım."}]},
    ]

    # Geçmiş mesajları ekle (son 10)
    for msg in history[-10:]:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg["text"]}]})

    # Yeni kullanıcı mesajını ekle
    contents.append({"role": "user", "parts": [{"text": message}]})

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.6,
            "maxOutputTokens": 1024,
        },
    }

    raw  = _gemini_post(payload)
    return _extract_text(raw).strip()
