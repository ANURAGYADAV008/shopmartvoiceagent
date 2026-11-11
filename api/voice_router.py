from __future__ import annotations

import base64
import logging
from pathlib import Path
from typing import NoReturn

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

from .Agent.graph import rag_agent_wrapper
from .models import (
    RAGUsedContext,
    VoiceChatResponse,
    VoiceSpeakRequest,
    VoiceTranscribeResponse,
)
from .rate_limit import limiter
from .voice import (
    UnsupportedLanguageError,
    VoiceError,
    VoiceNotConfiguredError,
    VoiceProviderError,
    is_configured,
    make_spoken_answer,
    max_audio_bytes,
    max_audio_mb,
    synthesize_speech,
    transcribe_audio,
    voice_config,
)

logger = logging.getLogger(__name__)

voice_router = APIRouter()

_ALLOWED_SUFFIXES = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac"}
_CONTENT_TYPE_SUFFIXES = {
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/m4a": ".m4a",
    "audio/ogg": ".ogg",
    "audio/flac": ".flac",
    "audio/x-flac": ".flac",
    "audio/aac": ".aac",
    "audio/x-aac": ".aac",
}


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "")


def _raise_voice_http(exc: VoiceError) -> NoReturn:
    if isinstance(exc, VoiceNotConfiguredError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if isinstance(exc, UnsupportedLanguageError):
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if isinstance(exc, VoiceProviderError):
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    raise HTTPException(status_code=502, detail=str(exc)) from exc


async def _read_audio(file: UploadFile) -> tuple[bytes, str]:
    """Read and validate an uploaded audio file without touching disk."""
    filename = (file.filename or "").strip()
    suffix = Path(filename).suffix.lower()

    if suffix not in _ALLOWED_SUFFIXES:
        content_type = (file.content_type or "").split(";", 1)[0].strip().lower()
        mapped_suffix = _CONTENT_TYPE_SUFFIXES.get(content_type)
        if not mapped_suffix:
            allowed = ", ".join(sorted(_ALLOWED_SUFFIXES))
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported audio format. Allowed: {allowed}.",
            )
        filename = f"{filename or 'clip'}{mapped_suffix}"

    limit = max_audio_bytes()
    data = await file.read(limit + 1)
    if not data:
        raise HTTPException(status_code=400, detail="Audio file is empty.")
    if len(data) > limit:
        raise HTTPException(
            status_code=400,
            detail=f"Audio file is too large (max {max_audio_mb():g} MB).",
        )
    return data, filename


@voice_router.get("/health")
def voice_health() -> dict:
    return {
        "status": "ok" if is_configured() else "not_configured",
        **voice_config(),
    }


@voice_router.post("/transcribe", response_model=VoiceTranscribeResponse)
@limiter.limit("10/minute")
async def voice_transcribe(
    request: Request,
    file: UploadFile = File(...),
    language_code: str | None = Form(None),
) -> VoiceTranscribeResponse:
    audio, filename = await _read_audio(file)

    try:
        transcript, language = await run_in_threadpool(
            transcribe_audio, audio, filename, language_code
        )
    except VoiceError as exc:
        _raise_voice_http(exc)

    return VoiceTranscribeResponse(
        request_id=_request_id(request),
        transcript=transcript,
        language_code=language,
    )


@voice_router.post("/speak")
@limiter.limit("10/minute")
def voice_speak(request: Request, payload: VoiceSpeakRequest) -> Response:
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="text must not be empty.")

    try:
        audio = synthesize_speech(
            payload.text,
            voice=payload.voice,
            language_code=payload.language_code,
            speed=payload.speed,
        )
    except VoiceError as exc:
        _raise_voice_http(exc)

    return Response(content=audio, media_type="audio/mpeg")


@voice_router.post("/chat", response_model=VoiceChatResponse)
@limiter.limit("10/minute")
async def voice_chat(
    request: Request,
    file: UploadFile = File(...),
    thread_id: str = Form("default-thread"),
    language_code: str | None = Form(None),
    voice: str | None = Form(None),
    speak: bool = Form(True),
) -> VoiceChatResponse:
    audio_bytes, filename = await _read_audio(file)

    try:
        transcript, language = await run_in_threadpool(
            transcribe_audio, audio_bytes, filename, language_code
        )
    except VoiceError as exc:
        _raise_voice_http(exc)

    try:
        result = await run_in_threadpool(
            rag_agent_wrapper, transcript, thread_id or "default-thread"
        )
    except Exception as exc:  # noqa: BLE001 - mirror the text /rag/ endpoint
        logger.exception("Failed to process voice chat request: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Internal error processing request: {exc}",
        ) from exc

    answer = result.get("answer", "") or ""
    spoken_answer = make_spoken_answer(answer)

    audio_base64: str | None = None
    audio_content_type: str | None = None

    if speak and spoken_answer:
        try:
            audio = await run_in_threadpool(
                synthesize_speech,
                spoken_answer,
                voice,
                language,
                None,
            )
            audio_base64 = base64.b64encode(audio).decode("ascii")
            audio_content_type = "audio/mpeg"
        except VoiceError as exc:
            # Voice degrades to text: the transcript and full answer are
            # still useful even when Timbre is unavailable.
            logger.warning("TTS failed for thread %s: %s", thread_id, exc)

    return VoiceChatResponse(
        request_id=_request_id(request),
        transcript=transcript,
        answer=answer,
        spoken_answer=spoken_answer,
        used_context=[
            RAGUsedContext(**item) for item in (result.get("used_context") or [])
        ],
        trace_id=result.get("trace_id"),
        shopping_cart=result.get("shopping_cart") or [],
        audio_base64=audio_base64,
        audio_content_type=audio_content_type,
        language_code=language,
    )
