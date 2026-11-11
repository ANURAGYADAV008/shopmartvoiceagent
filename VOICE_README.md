# ShopSmart Voice — Gnani Prisma + Timbre (backend only)

Voice layer on top of the existing RAG agent. No RAG code was changed.
The frontend lives in a separate project and is **not** included here.

## Flow

```
Mic (browser, MediaRecorder)
  -> POST /voice/chat  (audio file, multipart)
  -> Prisma v2.5 transcribes audio -> text
  -> rag_agent_wrapper(text, thread_id)  — SAME agent as POST /rag/
  -> make_spoken_answer() shortens the answer for speech (max ~400 chars)
  -> Timbre v2.5 synthesises the short answer -> MP3 (base64 in JSON)
  -> frontend renders the FULL answer + product cards, and PLAYS the MP3
```

## Files changed / added

| File | What |
|---|---|
| `api/voice.py` | **New.** Gnani service: `transcribe_audio()`, `synthesize_speech()`, `make_spoken_answer()`, config from env. The Gnani SDK is imported lazily, so the app still starts without a key. |
| `api/voice_router.py` | **New.** `GET /voice/health`, `POST /voice/transcribe`, `POST /voice/speak`, `POST /voice/chat`. |
| `api/models.py` | Added `VoiceTranscribeResponse`, `VoiceSpeakRequest`, `VoiceChatResponse`. |
| `api/app.py` | Mounted the voice router under `/voice` and used the shared limiter. Nothing else changed. |
| `api/rate_limit.py` | **New.** Shared SlowAPI limiter for the text and voice routers. |
| `pyproject.toml` | Added `gnani-vachana>=0.9.0` and `python-multipart` (required for multipart uploads). |
| `.env.example` | **New.** Added `GNANI_*` / `VOICE_*` vars. |
| `scripts/test_voice.py` | **New.** No-frontend smoke test for all four endpoints. |

SDK signatures were verified against **gnani-vachana 0.9.0** (installed and
introspected, 11 Nov 2026) — `GnaniSTTClient.transcribe_bytes(...)`,
`GnaniTTSClient.synthesize(..., model="timbre-v2.5", language="en-IN", ...)`.

## Setup

```bash
# 1. Install (in your venv)
uv sync
# or: pip install gnani-vachana python-multipart

# 2. Key — get one at https://app.gnani.ai, then in .env:
GNANI_API_KEY=your_key_here
# Optional overrides (defaults shown):
# GNANI_STT_MODEL=prisma-v2.5
# GNANI_STT_LANGUAGE=en-IN
# GNANI_TTS_MODEL=timbre-v2.5
# GNANI_TTS_VOICE=Nalini
# GNANI_TTS_LANGUAGE=en-IN
# GNANI_TTS_SPEED=1.0
# VOICE_MAX_AUDIO_MB=10

# 3. Run the API exactly as before
uvicorn api.app:app --reload --port 8002
```

## Test it (no frontend needed)

```bash
# Health — works without a key, tells you if voice is configured
curl http://localhost:8002/voice/health

# STT only — record a short clip first, e.g. "show me wireless headphones under 2000"
curl -X POST http://localhost:8002/voice/transcribe \
  -F "file=@clip.webm" -F "language_code=en-IN"

# TTS only — returns raw MP3
curl -X POST http://localhost:8002/voice/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"I found three wireless headphones under two thousand rupees."}' \
  --output speech.mp3

# Full voice chat — audio in, transcript + RAG answer + spoken MP3 (base64) out
curl -X POST http://localhost:8002/voice/chat \
  -F "file=@clip.webm" -F "thread_id=test-1" -F "language_code=en-IN"
```

Or run the script: `python scripts/test_voice.py --base-url http://localhost:8002 --audio clip.webm`

## Endpoints

### `GET /voice/health`
```json
{"status": "ok", "configured": true, "stt_model": "prisma-v2.5",
 "tts_model": "timbre-v2.5", "tts_voice": "Nalini",
 "default_language": "en-IN",
 "supported_languages": ["bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN",
  "ml-IN", "mr-IN", "pa-IN", "ta-IN", "te-IN"]}
```
`status` is `"not_configured"` when `GNANI_API_KEY` is missing. The frontend
should use this to enable/disable the mic button.

### `POST /voice/chat` — multipart form
| Field | Type | Notes |
|---|---|---|
| `file` | file | wav / webm / mp3 / m4a / ogg / flac, max 10 MB (VOICE_MAX_AUDIO_MB) |
| `thread_id` | string | default `default-thread` — same thread as the text chat, so voice + text share cart/history |
| `language_code` | string | optional, e.g. `en-IN`, `hi-IN` |
| `voice` | string | optional Timbre v2.5 voice override, e.g. `Kaveri` |
| `speak` | bool | default `true`. Set `false` for transcript + text answer only |

Response (`VoiceChatResponse`):
```json
{
  "request_id": "...",
  "transcript": "show me wireless headphones under 2000",
  "answer": "I found 3 wireless headphones under ₹2,000. ... (full text)",
  "spoken_answer": "I found 3 wireless headphones under 2000 rupees. ...",
  "used_context": [{"id": "...", "description": "...", "price": 499, "rating": 4.1, "image_url": "..."}],
  "trace_id": "...",
  "shopping_cart": [],
  "audio_base64": "<mp3 bytes, base64>",
  "audio_content_type": "audio/mpeg",
  "language_code": "en-IN"
}
```
`audio_base64` and `audio_content_type` are `null` when `speak=false` or TTS failed.

### `POST /voice/transcribe` — multipart, same `file` + `language_code`
Returns `{"request_id": "...", "transcript": "...", "language_code": "en-IN"}`.

### `POST /voice/speak` — JSON `{"text": "...", "voice": null, "language_code": null, "speed": null}`
Returns raw `audio/mpeg` (MP3). Use it to preview voices.

## Errors

| Status | Meaning |
|---|---|
| 400 | Unsupported language, bad audio, or audio over the size limit |
| 429 | Over the 10/minute voice rate limit |
| 500 | RAG agent failed (voice worked, RAG didn't) |
| 502 | Gnani STT/TTS call failed (key invalid, Gnani down, audio unreadable) |
| 503 | `GNANI_API_KEY` not set |

Note: in `/voice/chat`, if **TTS fails but STT + RAG worked**, you still get
the transcript + full text answer with `audio_base64: null` — voice degrades
to text instead of erroring the whole turn.

## Things to know before deploying

- **Rate limit:** voice is 10/minute; text `/rag/` is 2/minute. Tighten voice
  before any public deploy.
- **Audio is never persisted by the app** — it is read for the one request and
  discarded (Starlette may spool a large upload to a temporary file while the
  request is being parsed).
- **Browser audio is webm** (MediaRecorder default). Gnani accepts it via
  `transcribe_bytes(..., filename="clip.webm")`. If a specific browser's webm
  ever fails, record wav instead.
- **Latency:** voice adds STT + TTS on top of RAG (~6 s/query in the RAGAS
  eval). Expect roughly 8–12 s per voice turn end-to-end.
- **Don't put the Gnani key in the frontend.** All Gnani calls are server-side.
