# MBG Catering — Sistem Manajemen Bisnis

Sistem manajemen catering MBG (Makanan Bergizi Gratis) berbasis Telegram Bot + Web Dashboard.

## Struktur Project

```
folder fix/
├── backend/          FastAPI — REST API
├── bot/              Telegram Bot (python-telegram-bot)
├── web/              Next.js 14 App Router
└── requirements.txt  Python deps (project root)
```

---

## Prerequisites

| Komponen       | Versi    | Keterangan                     |
|----------------|----------|--------------------------------|
| Python         | 3.11+    | Backend + Bot                  |
| Node.js        | 18+      | Web                            |
| Redis          | 6+       | Queue OCR + session            |
| Supabase       | Cloud    | Database + Storage             |
| Telegram Bot   | —        | @BotFather → dapatkan token    |
| Gemini API Key | —        | Google AI Studio               |

---

## Setup Development

### 1. Clone dan buat virtual environment

```bash
git clone <repo> .
python -m venv .venv
.venv\Scripts\activate        # Windows
# atau: source .venv/bin/activate  (Linux/Mac)
pip install -r requirements.txt
```

### 2. Backend (FastAPI)

```bash
cd backend
cp .env.template .env
# Edit .env — isi semua ENV vars wajib
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs
Health check: http://localhost:8000/health

### 3. Bot (Telegram)

```bash
cd bot
python main.py
```

Bot akan polling Telegram. Tekan Ctrl+C untuk stop.

### 4. Web (Next.js)

```bash
cd web
npm install
cp .env.local.template .env.local
# Edit .env.local
npm run dev
```

Web: http://localhost:3000

### 5. Worker OCR (terpisah dari backend)

```bash
cd backend
rq worker ocr_queue --url redis://localhost:6379
```

> ⚠️ Worker harus jalan terpisah dari backend uvicorn.  
> Di production, jalankan sebagai service/daemon.

---

## Environment Variables

### `backend/.env`

| Variable               | Wajib | Keterangan                           |
|------------------------|-------|--------------------------------------|
| `SUPABASE_URL`         | ✅    | URL Supabase project                 |
| `SUPABASE_SERVICE_KEY` | ✅    | Service role key (bukan anon key)    |
| `SECRET_KEY`           | ✅    | JWT secret — gunakan string random panjang |
| `TELEGRAM_BOT_TOKEN`   | ✅    | Token dari @BotFather                |
| `GEMINI_API_KEY`       | ✅    | Google AI Studio API key             |
| `REDIS_URL`            | ✅    | `redis://localhost:6379`             |
| `APP_ENV`              | —     | `development` atau `production`      |
| `WEB_URL`              | —     | URL web app (untuk CORS production)  |
| `BACKEND_URL`          | —     | URL backend sendiri                  |
| `GEMINI_OCR_MODEL`     | —     | Default: `gemini-2.5-flash`          |
| `GEMINI_TEXT_MODEL`    | —     | Default: `gemini-2.5-flash-lite`     |

### `bot/.env`

| Variable               | Wajib | Keterangan                        |
|------------------------|-------|-----------------------------------|
| `TELEGRAM_BOT_TOKEN`   | ✅    | Sama dengan backend               |
| `BACKEND_URL`          | ✅    | URL FastAPI backend               |
| `REDIS_URL`            | ✅    | URL Redis                         |

### `web/.env.local`

| Variable                      | Wajib | Keterangan              |
|-------------------------------|-------|-------------------------|
| `NEXT_PUBLIC_BACKEND_URL`     | ✅    | URL FastAPI backend     |
| `NEXT_PUBLIC_SUPABASE_URL`    | —     | Untuk fitur tertentu    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | —  | Supabase anon key       |

---

## Quick Deploy

### Prerequisites
- GitHub account
- Railway account (railway.app)
- Vercel account (vercel.com)
- Supabase project (sudah ada)
- Telegram Bot Token (sudah ada)
- Gemini API Key (sudah ada)

### Deploy Steps

1. Push ke GitHub
   git remote add origin https://github.com/USERNAME/REPO.git
   git push -u origin master

2. Railway — Redis
   New Project → Add Service → Database → Redis
   Catat REDIS_URL

3. Railway — Backend
   New Service → GitHub Repo
   Root: backend
   Add ENV vars dari backend/.env.example
   Generate Domain → catat URL

4. Railway — OCR Worker
   New Service → GitHub Repo (sama)
   Root: backend
   Start Command: rq worker ocr_queue --url $REDIS_URL
   Copy ENV vars dari backend

5. Railway — Bot
   New Service → GitHub Repo (sama)
   Root: bot
   Add ENV vars dari bot/.env.example

6. Vercel — Web
   New Project → Import GitHub Repo
   Root: web
   Add ENV vars dari web/.env.example
   Deploy → catat URL

7. Update ENV setelah dapat semua URL
   Backend: WEB_URL + BACKEND_URL
   Bot: BACKEND_URL
   Web: NEXT_PUBLIC_BACKEND_URL

8. Test
   GET https://your-backend.railway.app/health
   → harus return {"status": "ok"}

---

## Deploy Production (Ringkasan)

| Service  | Rekomendasi Platform           |
|----------|--------------------------------|
| Backend  | Railway / Render / VPS (Ubuntu)|
| Bot      | Railway / VPS (harus 24/7)    |
| Web      | Vercel (gratis tier tersedia)  |
| Redis    | Redis Cloud / Railway Redis    |
| Database | Supabase (sudah cloud)         |
| Worker   | Sama VPS dengan backend        |

Lihat detail: [`backend/DEPLOY.md`](backend/DEPLOY.md)

---

## Arsitektur

```
Telegram Bot ──POST──▶ FastAPI Backend ──▶ Supabase DB
     │                      │
     │                    Redis
     │                (OCR queue/session)
     ▼                      │
  User/Owner            OCR Worker
                       (rq worker)
                            │
                         Gemini AI
                            │
                      Supabase Storage
                       (foto nota)
Web Dashboard ──GET──▶ FastAPI Backend
```

---

## Aturan Bisnis Penting

- 🤖 **Bot = INPUT**: belanja, penyerahan MBG, konfirmasi nota
- 🌐 **Web = OUTPUT + SETUP**: dashboard, laporan, download Excel
- 💰 **PPh22 dihitung HANYA saat generate Excel** (bukan saat input)
- 📊 **Alokasi**: 80% makanan / 15% tenaga / 5% operasional (dari settings tenant)
- 🔒 **Multi-tenant**: semua data difilter per `tenant_id`

---

## Backup & Monitoring

- **Database**: Supabase memiliki backup otomatis (Point-in-Time Recovery)
- **Gemini quota**: pantau di [Google AI Studio](https://aistudio.google.com)
- **Health check**: `GET /health` untuk monitoring uptime
- **Logs**: JSON structured logging di backend (lihat `middleware/logging.py`)
