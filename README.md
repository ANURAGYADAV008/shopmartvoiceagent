# ShopSmart — Agentic RAG shopping assistant

React + FastAPI shopping assistant with product search, a shopping cart, and
voice chat (Gnani Prisma STT + Timbre TTS).

## Local setup

### 1. PostgreSQL

The app uses a local Docker PostgreSQL instead of Neon:

```powershell
docker compose up -d postgres
```

This starts `shopsmart-postgres` on **localhost:5433** with:

| Setting | Value |
|---|---|
| Database | `shopsmart` |
| User | `shopsmart` |
| Password | `shopsmart_dev` |
| Host port | `5433` (5432 is often already taken) |

The data lives in the `shopsmart_pgdata` volume. `docker compose down` keeps it;
`docker compose down -v` deletes it.

The app's LangGraph checkpoints and shopping-cart tables are created on first use.

### 2. Environment

Copy `.env.example` to `.env` and fill in the keys you need:

```ini
OPENAI_API_KEY=...
QDRANT_URL=...
QDRANT_API_KEY=...
QDRANT_COLLECTION_NAME=...
GNANI_API_KEY=...          # enables voice
DB_URI=postgresql://shopsmart:shopsmart_dev@localhost:5433/shopsmart
DATABASE_URL=postgresql://shopsmart:shopsmart_dev@localhost:5433/shopsmart
```

`GNANI_API_KEY` stays on the server. The browser only talks to the FastAPI API.

### 3. Backend

```powershell
uv sync
.\.venv\Scripts\python.exe -m uvicorn api.app:app --host 127.0.0.1 --port 8002 --reload
```

### 4. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api/*` to `http://localhost:8002`,
so local development needs no CORS changes.

## Voice chat

Tap the mic in the composer, speak, and tap the stop button. The browser sends
the recording to `POST /voice/chat`; the API transcribes it, runs the same RAG
agent as text chat, and returns the transcript, the full answer, and an MP3 of a
shortened spoken answer. The mic is disabled when `GNANI_API_KEY` is not set.

See `VOICE_README.md` for endpoint details and `python scripts/test_voice.py`
for a no-frontend smoke test.

## Checks

```powershell
# Backend
.\.venv\Scripts\python.exe -m compileall -q api scripts

# Frontend
cd frontend
npm run lint
npm run build
```
