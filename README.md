# 🏪 DijitalEsnaf — KOBİ'ler İçin Yapay Zeka Destekli E-Ticaret Asistanı

![Hackathon](https://img.shields.io/badge/Hackathon-'26-blue) ![Google](https://img.shields.io/badge/AI-Google_Gemini-orange) ![FastAPI](https://img.shields.io/badge/Backend-FastAPI-green) ![React](https://img.shields.io/badge/Frontend-React-cyan)

**BTK Akademi × Google × Girişimcilik Vakfı — Hackathon '26** yarışması için geliştirilmiştir.

**DijitalEsnaf**, e-ticarete yeni başlayan veya operasyonlarını büyütmek isteyen KOBİ'ler için geliştirilmiş uçtan uca, yapay zeka destekli bir e-ticaret yönetim ve finans platformudur.

**🔗 [Canlı Demo Linki]** (https://hackathon-26-codegean.vercel.app/)  
**📹 [1 Dakikalık Tanıtım Videosu]** (https://youtu.be/uKKka8-hxCQ)

---

## 💡 Ürünün Özü ve Kullanıcı Değeri

E-ticaret satıcıları için en büyük zaman kaybı; kaliteli ürün fotoğrafları hazırlamak, SEO uyumlu ilan metinleri yazmak ve karmaşık finansal tabloları (kâr/zarar, iade oranları, kargo giderleri) takip etmektir. 

DijitalEsnaf, "Agentic" yapay zeka akışları sayesinde tek bir ürün fotoğrafından satışa hazır bir ilanı saniyeler içinde oluşturur. Aynı zamanda satıcının tüm sipariş, iade ve finansal verilerini tek bir merkezde (`finance_records`) toplayarak, anomali tespit motoru ve finans asistanı ile satıcıyı iflastan veya zarar etmekten korur.

---

## 🤖 Agentic Akış ve AI Mimarisi

Sistemimiz, jürinin değerlendirme kriterlerinde yer alan **Agentic Yapılar** etrafında şekillendirilmiştir:

1. **[Agent 1] Görsel Segmentasyon:** Kullanıcı görseli yükler. Sistem, e-ticaret görselleri için optimize edilmiş **rembg (U2-Net)** modeli ile arka planı temizler ve şeffaf PNG üretir.
2. **[Agent 2] Görsel Analiz & İçerik Üretimi:** **Gemini 2.5 Flash Vision** devreye girer. Görseli okuyarak ürünü 50 ana kategori arasından otomatik sınıflandırır; seçilen tona göre başlık, açıklama, teknik özellikler ve SEO etiketlerini üretir.
3. **[Agent 3] Otonom Kalite Kontrol:** Üretilen içerikte eksik bir alan (örn. SEO etiketi) varsa, agent kendi kendini tetikleyerek (max 2 deneme) eksikleri tamamlar.
4. **[Agent 4] Floating Chat Asistanı:** Satıcı sonucu beğenmezse, yüzen asistan ile konuşarak ("Başlığı daha kısa yap") sadece ilgili kısımları güncelletebilir.

---

## 🚀 Temel Özellikler

* **SQL-Tabanlı RAG (Satış & Finans Asistanları):** Klasik pgvector yerine, finansal ve istatistiksel doğruluk için satıcının yapısal verileri (aktif ilan sayısı, en çok satanlar, sektör ortalamaları, iptal/iade oranları) SQL sorguları ile toplanıp Gemini'ye sistem promptu olarak iletilir.
* **Anomali Tespit Motoru:** Arka planda 5 dakikada bir çalışan sistem; reklam/gelir oranı, nakit akışı trendi, sıfır stok uyarısı, düşük puanlı ilanlar ve ani gider artışları gibi 7 farklı kuralı denetler. Kritik bir durum varsa kullanıcıyı global bir 🔔 zili ile uyarır ve Gemini asistanı proaktif çözüm sunar.
* **Tek Gerçeklik Kaynağı (Single Source of Truth):** Tüm gelir, gider, komisyon ve kargo ücretleri Supabase trigger'ları aracılığıyla otomatik olarak tek bir `finance_records` tablosuna işlenir. Gerçek net kâr hesabı hatasız yapılır.
* **Dinamik Müşteri Vitrini:** Müşterilerin ürünleri görüp, sepete ekleyebildiği, sipariş verebildiği ve teslim edilen ürünlere yorum/puan (1-5 yıldız) bırakabildiği çift taraflı platform deneyimi.

---

## 🛠️ Teknoloji Yığını

| Katman | Teknoloji | Görevi / Kullanım Amacı |
| :--- | :--- | :--- |
| **Yapay Zeka** | Gemini 2.5 Flash / Vision | İçerik üretimi, kategori tespiti, chat asistanları |
| **Görsel İşleme** | rembg (U2-Net) | Otonom arka plan temizleme |
| **Backend** | FastAPI (Python) | RESTful API, asenkron işlemler (`asyncio.to_thread`) |
| **Frontend** | React, Vite, Tailwind CSS | Kullanıcı arayüzü, çift panel yapısı (Satış/Finans) |
| **Veritabanı & Auth**| Supabase (PostgreSQL) | Auth, Storage, Database, Trigger'lar |


## ⚙️ Kurulum Talimatları

Projeyi kendi lokal ortamınızda çalıştırmak için aşağıdaki adımları izleyebilirsiniz.

### 1. Backend Kurulumu

```bash
# Repo'yu klonlayın
git clone <repo-url>
cd Konsept_Mimari_REMBG_Docker/backend

# Sanal ortam oluşturun ve aktif edin (Opsiyonel ama önerilir)
python -m venv venv
source venv/bin/activate  # Windows için: venv\Scripts\activate

# Gerekli kütüphaneleri yükleyin
pip install -r requirements.txt

# .env dosyasını oluşturun ve Supabase/Gemini API key'lerinizi ekleyin
# SUPABASE_URL=...
# SUPABASE_KEY=...
# GEMINI_API_KEY=...

# Uvicorn ile sunucuyu başlatın
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

2. Frontend Kurulumu

# Frontend klasörüne geçiş yapın
cd ../frontend

# Bağımlılıkları yükleyin
npm install

# .env dosyasını oluşturun
# VITE_API_URL=http://localhost:8000

# Geliştirme sunucusunu başlatın
npm run dev
