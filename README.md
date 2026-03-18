# Living Story App

An 8-day interactive narrative installation. Multiple users upload images from their phones. Each image is analysed, and a local LLM (Ollama) generates a new story chapter. Everything streams live to the browser and to a Unity installation via Socket.IO.

---

## Project Structure

```
living-story/
  backend/    → Node.js + Express + Socket.IO → deploy to Heroku
  frontend/   → React + Vite → deploy to Vercel
  sidecar/    → Python (MediaPipe + rembg) → runs on your laptop
  ngrok.yml   → tunnels laptop services to the internet
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- Ollama installed (https://ollama.com)
- ngrok account + CLI installed
- Cloudinary account (free tier is fine)
- Heroku account + CLI
- Vercel account + CLI

---

### 1. Backend (Heroku)

```bash
cd backend
cp .env.example .env
# Fill in all values in .env

npm install
npx prisma generate
npx prisma migrate dev --name init   # local dev only

# Deploy to Heroku:
heroku create your-app-name
heroku addons:create heroku-postgresql:mini
heroku config:set $(cat .env | xargs)
git subtree push --prefix backend heroku main
heroku run npx prisma migrate deploy
```

### 2. Python Sidecar (your laptop)

```bash
cd sidecar
cp .env.example .env
# Fill in Cloudinary values

pip install -r requirements.txt
python app.py
# First run downloads rembg ONNX model (~170MB) — be patient!
# Runs on http://localhost:5001
```

### 3. Ollama (your laptop)

```bash
ollama pull mistral
ollama serve
# Runs on http://localhost:11434
```

### 4. ngrok (your laptop)

```bash
# Copy ngrok.yml to ~/.config/ngrok/ngrok.yml
cp ngrok.yml ~/.config/ngrok/ngrok.yml

ngrok start --all
# You'll get two HTTPS URLs — copy them into Heroku:
heroku config:set OLLAMA_URL=https://xxxx.ngrok.io
heroku config:set REMBG_URL=https://yyyy.ngrok.io
```

> ⚠️ ngrok free tier gives new URLs on every restart. Update Heroku env vars each time.
> ngrok paid ($8/mo) gives static URLs — recommended for an 8-day installation.

### 5. Frontend (Vercel)

```bash
cd frontend
cp .env.example .env
# Fill in your Heroku app URL

npm install
npm run dev    # local dev

# Deploy to Vercel:
vercel deploy --prod
```

---

## Environment Variables

### backend/.env
| Variable | Description |
|---|---|
| CLOUDINARY_CLOUD_NAME | Your Cloudinary cloud |
| CLOUDINARY_API_KEY | Cloudinary API key |
| CLOUDINARY_API_SECRET | Cloudinary secret |
| DATABASE_URL | PostgreSQL URL (Heroku sets this) |
| OLLAMA_URL | ngrok public URL for Ollama |
| REMBG_URL | ngrok public URL for Python sidecar |
| STORY_START_DATE | ISO date of Day 1 e.g. 2026-03-10 |
| CLIENT_ORIGIN | Your Vercel app URL |

### frontend/.env
| Variable | Description |
|---|---|
| VITE_API_URL | Your Heroku app URL |
| VITE_SOCKET_URL | Your Heroku app URL |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /api/upload | Main pipeline — upload image, generate chapter, broadcast |
| PATCH | /api/chapter/:id/retry | Retry LLM generation if it failed |
| GET | /api/events | All upload events + current day |
| GET | /api/story | All chapters in order |

---

## Socket.IO Events

### Server → Clients
| Event | Payload |
|---|---|
| pipeline_start | (empty) — upload begun |
| new_chapter | { day, headline, cloudinaryUrl, cutouts, analysis, chapterText, timestamp } |
| pipeline_error | { uploadEventId?, reason } |

### Unity Integration
Connect Unity client to your Heroku Socket.IO URL and listen for `new_chapter`.
The `cutouts` object contains named PNG URLs: `left_eye`, `right_eye`, `mouth`, `nose`, `subject`.

---

## Day-by-Day Chapters

| Day | Headline | Tone |
|---|---|---|
| 1 | The Arrival | Wonder and disorientation |
| 2 | First Impressions | Observational, slightly unsettling |
| 3 | The Market | Bustling, sensory-rich |
| 4 | Hidden Rooms | Introspective, secretive |
| 5 | The Storm | Tense, rupturing |
| 6 | Aftermath | Quiet, reckoning |
| 7 | The Return | Bittersweet |
| 8 | What Remains | Elegiac, conclusive |

Day advances automatically at midnight from `STORY_START_DATE`.

---

## Event Day Checklist

- [ ] Laptop plugged in, sleep/screensaver disabled (`caffeinate -i` on macOS)
- [ ] `ollama serve` running
- [ ] `python sidecar/app.py` running
- [ ] `ngrok start --all` running
- [ ] Heroku OLLAMA_URL + REMBG_URL updated with today's ngrok URLs
- [ ] STORY_START_DATE set to today's date in Heroku config
- [ ] Test upload from phone before opening to public
