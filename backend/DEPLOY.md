# Deploy Checklist — Production

Jalankan checklist ini sebelum deploy ke production.

## ENV Variables

- [ ] `SUPABASE_URL` — URL Supabase project
- [ ] `SUPABASE_SERVICE_KEY` — service role key (bukan anon)
- [ ] `SECRET_KEY` — JWT secret, min 32 karakter, random
- [ ] `TELEGRAM_BOT_TOKEN` — dari @BotFather
- [ ] `GEMINI_API_KEY` — dari Google AI Studio
- [ ] `REDIS_URL` — URL Redis instance production
- [ ] `APP_ENV=production` — penting untuk CORS restriction
- [ ] `WEB_URL` — URL domain web app (untuk CORS)
- [ ] `BACKEND_URL` — URL backend sendiri

## Validasi Startup

```bash
cd backend
python -c "from core.config import validate_config; validate_config(); print('OK')"
```

Tidak boleh ada error sebelum deploy.

## Database

- [ ] Supabase migrations applied: `supabase db push`
- [ ] RLS (Row Level Security) aktif di semua tabel
- [ ] Function `increment_stock` sudah dibuat (SQL Editor)

## Storage

- [ ] Bucket `nota-photos` sudah dibuat di Supabase Storage
- [ ] Public bucket: ✅ Yes
- [ ] Allowed MIME: `image/jpeg`, `image/png`

## Redis

- [ ] Redis accessible dari backend dan bot
- [ ] Test: `redis-cli -u $REDIS_URL ping` → PONG

## CORS

- [ ] `APP_ENV=production` di backend `.env`
- [ ] `WEB_URL` diset ke domain production

## Health Check

```bash
curl https://<backend-url>/health
# Expected: {"status": "ok", ...}
```

- [ ] `database: "ok"`
- [ ] `redis: "ok"`
- [ ] `storage: "ok"`

## Web (Vercel)

- [ ] `NEXT_PUBLIC_BACKEND_URL` diset ke URL backend production
- [ ] Build berhasil: `npm run build`

## Bot

- [ ] Bot hanya berjalan 1 instance (tidak bisa duplikat)
- [ ] Pastikan tidak ada instance lain yang running

## Monitoring

- [ ] Setup health check monitoring (UptimeRobot / Better Uptime)
- [ ] Target: `GET /health` setiap 5 menit
- [ ] Pantau quota Gemini di Google AI Studio
