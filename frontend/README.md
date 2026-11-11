# ShopSmart Frontend

A clean React chat interface for the Amazon Electronics Agentic RAG backend.

Built with **React 19 + TypeScript + Vite + Tailwind CSS 4**.

## Run locally

`npm run dev` calls `/api/*`, and Vite proxies it to the local FastAPI server on
`http://localhost:8002` (see `vite.config.ts`). No deployed URL is needed.

```powershell
# Terminal 1 — PostgreSQL
cd <repo root>
docker compose up -d postgres

# Terminal 2 — backend
cd <repo root>
.\.venv\Scripts\python.exe -m uvicorn api.app:app --host 127.0.0.1 --port 8002 --reload

# Terminal 3 — frontend
cd <repo root>\frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

## API connection

### Local development

`npm run dev` loads `.env.development`, which leaves `VITE_API_URL` unset so the
app calls `/api/*` and Vite proxies it to the local FastAPI server:

```text
Browser → http://localhost:5173/api/rag
Vite    → http://localhost:8002/rag
```

That proxy is configured in `vite.config.ts` and means **no CORS changes are needed for local development**.

### Deployed backend

`npm run build` loads `.env.production`, which points the app at the deployed FastAPI backend:

```ini
VITE_API_URL=https://amazon-ecommerce-a4w5adfk4-anurag-yadavs-projects-d06c16b1.vercel.app
```

This is a deployment-specific URL, so it changes whenever the backend is redeployed.
Copy the latest URL from Vercel → Deployments and update both env files when that happens.
If the frontend project defines `VITE_API_URL` in its Vercel settings, that value overrides
`.env.production` — update it there as well.

The backend must allow the frontend origin through CORS (already configured in
`amazon_ecommerce/api/app.py`; `*.vercel.app` and the local Vite ports are allowed).

If the backend deployment URL changes, update `.env.production` or set
`VITE_API_URL` in the frontend hosting dashboard, then rebuild.

> **Vercel Deployment Protection must be disabled for the backend project.**
> Otherwise every API request is answered with the Vercel login page instead of
> JSON, and the UI shows "API offline".

Do not put OpenAI or LangSmith keys in this frontend. Only the API URL belongs here.

## Voice chat

The mic button records a voice note and sends it to `POST /voice/chat`. The
backend transcribes it with Gnani Prisma, runs the same RAG agent, and returns
the transcript, the full text answer, and a spoken MP3 answer.

- The mic is enabled only when `GET /voice/health` reports `configured: true`.
- `GNANI_API_KEY` must be set in the backend `.env`; the key never reaches the browser.
- Recordings stop automatically after 60 seconds. MediaRecorder's WebM/m4a clip
  is converted in the browser to 16 kHz mono WAV before upload (Gnani rejects
  WebM). Audio Blob URLs are never written to `localStorage`.
- If TTS fails, the transcript and text answer still render without the player.

## Implemented

- Chat UI with Markdown answers and suggestion prompts
- Product cards under assistant answers
- "Add" on a product card sends a conversational add-to-bag request through `/rag`
- Voice input with recording timer, automatic transcript, and spoken-answer playback
- Voice availability comes from `/voice/health` (mic disabled when Gnani is not configured)
- Slide-in shopping bag drawer with item count, quantities, images, and subtotal
- Chat and bag persistence in `localStorage`
- FastAPI health indicator with 30-second polling
- Loading stages, error states, retry action, and copy-answer button
- Responsive layout and keyboard-accessible drawer
- Amazon product image fallback when an image is unavailable
- Local conversation ID reused across refreshes

## Recommended backend follow-ups

- Add `product_id`, `title`, `average_rating`, and `currency` to `used_context`, and deduplicate products per turn.
- Add cart endpoints: `GET /cart`, `POST /cart/items`, `PATCH /cart/items/{product_id}`, `DELETE /cart/items/{product_id}`.
- Return a real LangSmith run ID and fix `/submit_feedback`.
- Add `POST /rag/stream` with SSE stage events, then optionally token streaming.
- Add `GET /conversations/{thread_id}` for cross-device history.
- Separate `user_id`, `conversation_id`, and `cart_id`; add auth before exposing this publicly.

## Scripts

```powershell
npm run dev      # Vite dev server on 5173
npm run build    # Typecheck + production build
npm run preview  # Preview the production build
npm run lint     # oxlint
```

## Structure

```text
src/
  components/
    AudioPlayer.tsx     Compact player for spoken answers
    CartDrawer.tsx      Slide-in bag panel
    ChatWorkspace.tsx   Scroll area + composer
    Composer.tsx        Auto-growing input + mic control
    EmptyState.tsx      Welcome screen and suggestions
    Header.tsx          Brand, API status, new chat, bag button
    Markdown.tsx        Sanitized Markdown renderer
    MessageBubble.tsx   User/assistant messages, products, feedback actions
    ProductCard.tsx     Product result card
    ProductImage.tsx    Image with fallback
    ThinkingIndicator.tsx
  hooks/
    useChat.ts          Chat state, text/voice requests, retry, persistence
    useVoiceRecorder.ts MediaRecorder lifecycle and permission errors
  lib/
    api.ts              FastAPI client
    audio.ts            Base64 decoding, WAV transcoding, duration formatting
    format.ts           Price, cart, and title formatting
    storage.ts          Versioned localStorage helpers
    types.ts            API and UI types
```

## Local data

The app stores data under:

```text
shopsmart.chat.v1
```

Clear site storage to start completely fresh.
