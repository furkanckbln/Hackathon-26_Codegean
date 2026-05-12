-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. KULLANICILAR
CREATE TABLE users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id),
  email       text UNIQUE NOT NULL,
  store_name  text,
  created_at  timestamptz DEFAULT now()
);

-- 2. İLANLAR
CREATE TABLE listings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  short_desc      text,
  long_desc       text,
  category        text,
  price           numeric(10,2),
  stock           integer DEFAULT 0,
  features        jsonb,
  seo_tags        jsonb,
  status          text DEFAULT 'draft',
  image_url       text,
  clean_image_url text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 3. FİNANS KAYITLARI
CREATE TABLE finance_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  amount      numeric(10,2) NOT NULL,
  category    text,
  description text,
  record_date date NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- 4. SATICI RAG EMBEDDİNG
CREATE TABLE seller_embeddings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  content     text NOT NULL,
  embedding   vector(768),
  source_type text,
  source_id   uuid,
  created_at  timestamptz DEFAULT now()
);

-- 5. SEKTÖR RAG EMBEDDİNG
CREATE TABLE sector_embeddings (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content   text NOT NULL,
  embedding vector(768),
  topic     text,
  created_at timestamptz DEFAULT now()
);

-- 6. CHAT GEÇMİŞİ
CREATE TABLE chat_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  role       text,
  message    text,
  created_at timestamptz DEFAULT now()
);

-- vektör arama indexi
CREATE INDEX ON seller_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
