"""Gnani Prisma (STT) + Timbre (TTS) helpers for the voice layer.

The Gnani SDK is imported lazily so the API can start without the package or
without ``GNANI_API_KEY`` configured.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

DEFAULT_LANGUAGE = "en-IN"
DEFAULT_STT_MODEL = "prisma-v2.5"
DEFAULT_TTS_MODEL = "timbre-v2.5"
DEFAULT_TTS_VOICE = "Nalini"
DEFAULT_TTS_SPEED = 1.0
DEFAULT_MAX_AUDIO_MB = 10.0
MAX_SPOKEN_CHARS = 400

SUPPORTED_LANGUAGES: frozenset[str] = frozenset(
    {
        "bn-IN",
        "en-IN",
        "gu-IN",
        "hi-IN",
        "kn-IN",
        "ml-IN",
        "mr-IN",
        "pa-IN",
        "ta-IN",
        "te-IN",
    }
)


class VoiceError(RuntimeError):
    """Base error for the voice layer."""


class VoiceNotConfiguredError(VoiceError):
    """Raised when ``GNANI_API_KEY`` is missing."""


class UnsupportedLanguageError(VoiceError):
    """Raised when a language code is not supported by Gnani."""


class VoiceProviderError(VoiceError):
    """Raised when a Gnani STT/TTS call fails."""


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


def _env(name: str, default: str) -> str:
    value = os.getenv(name, "").strip()
    return value or default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        logger.warning("Invalid %s=%r, using %s", name, raw, default)
        return default
    return value if value > 0 else default


def api_key() -> str:
    return os.getenv("GNANI_API_KEY", "").strip()


def is_configured() -> bool:
    return bool(api_key())


def stt_model() -> str:
    return _env("GNANI_STT_MODEL", DEFAULT_STT_MODEL)


def tts_model() -> str:
    return _env("GNANI_TTS_MODEL", DEFAULT_TTS_MODEL)


def tts_voice() -> str:
    return _env("GNANI_TTS_VOICE", DEFAULT_TTS_VOICE)


def tts_speed() -> float:
    return _env_float("GNANI_TTS_SPEED", DEFAULT_TTS_SPEED)


def max_audio_mb() -> float:
    return _env_float("VOICE_MAX_AUDIO_MB", DEFAULT_MAX_AUDIO_MB)


def max_audio_bytes() -> int:
    return int(max_audio_mb() * 1024 * 1024)


def default_stt_language() -> str:
    language = _env("GNANI_STT_LANGUAGE", DEFAULT_LANGUAGE)
    return language if language in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def default_tts_language() -> str:
    language = _env("GNANI_TTS_LANGUAGE", DEFAULT_LANGUAGE)
    return language if language in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def voice_config() -> dict[str, Any]:
    """Public, non-secret configuration used by ``GET /voice/health``."""
    return {
        "configured": is_configured(),
        "stt_model": stt_model(),
        "tts_model": tts_model(),
        "tts_voice": tts_voice(),
        "default_language": default_stt_language(),
        "supported_languages": sorted(SUPPORTED_LANGUAGES),
    }


def _require_api_key() -> str:
    key = api_key()
    if not key:
        raise VoiceNotConfiguredError(
            "Voice is not configured. Set GNANI_API_KEY on the server."
        )
    return key


def validate_language(language_code: str | None) -> str:
    """Validate an explicit language code, falling back to the default."""
    language = (language_code or default_stt_language()).strip()
    if language not in SUPPORTED_LANGUAGES:
        supported = ", ".join(sorted(SUPPORTED_LANGUAGES))
        raise UnsupportedLanguageError(
            f"Unsupported language_code {language!r}. Supported: {supported}."
        )
    return language


def resolve_tts_language(language_code: str | None) -> str:
    language = (language_code or default_tts_language()).strip()
    if language not in SUPPORTED_LANGUAGES:
        supported = ", ".join(sorted(SUPPORTED_LANGUAGES))
        raise UnsupportedLanguageError(
            f"Unsupported language_code {language!r}. Supported: {supported}."
        )
    return language


# ---------------------------------------------------------------------------
# STT
# ---------------------------------------------------------------------------


def _extract_transcript(result: Any) -> str:
    if isinstance(result, dict):
        text = result.get("transcript") or result.get("text") or ""
    else:
        text = getattr(result, "transcript", None) or getattr(result, "text", None) or ""
    return str(text).strip()


def transcribe_audio(
    audio: bytes,
    filename: str = "clip.webm",
    language_code: str | None = None,
) -> tuple[str, str]:
    """Transcribe raw audio bytes and return ``(transcript, language_code)``."""
    key = _require_api_key()
    language = validate_language(language_code)

    try:
        from gnani.stt import GnaniSTTClient  # pyright: ignore[reportMissingImports]

        client = GnaniSTTClient(api_key=key)
        result = client.transcribe_bytes(
            audio,
            filename=filename,
            language_code=language,
            model=stt_model(),
        )
    except Exception as exc:  # noqa: BLE001 - the SDK has several error types
        logger.exception("Gnani STT request failed")
        raise VoiceProviderError(f"Gnani STT request failed: {exc}") from exc

    transcript = _extract_transcript(result)
    if not transcript:
        raise VoiceProviderError("Gnani STT returned an empty transcript.")
    return transcript, language


# ---------------------------------------------------------------------------
# TTS
# ---------------------------------------------------------------------------


def synthesize_speech(
    text: str,
    voice: str | None = None,
    language_code: str | None = None,
    speed: float | None = None,
) -> bytes:
    """Synthesise text with Timbre and return MP3 bytes."""
    key = _require_api_key()
    cleaned = (text or "").strip()
    if not cleaned:
        raise VoiceProviderError("Cannot synthesise empty text.")

    model = tts_model()
    selected_voice = (voice or "").strip() or tts_voice()
    selected_speed = speed if speed is not None else tts_speed()

    try:
        from gnani.tts import AudioConfig, GnaniTTSClient  # pyright: ignore[reportMissingImports]

        kwargs: dict[str, Any] = {
            "voice": selected_voice,
            "model": model,
            "audio_config": AudioConfig(
                container="mp3",
                sample_rate=48000,
                bitrate="128k",
            ),
        }
        if model != "timbre-v2.0":
            kwargs["language"] = resolve_tts_language(language_code)
            kwargs["speed"] = selected_speed

        client = GnaniTTSClient(api_key=key)
        audio = client.synthesize(cleaned, **kwargs)
    except VoiceError:
        raise
    except Exception as exc:  # noqa: BLE001 - the SDK has several error types
        logger.exception("Gnani TTS request failed")
        raise VoiceProviderError(f"Gnani TTS request failed: {exc}") from exc

    if not audio:
        raise VoiceProviderError("Gnani TTS returned empty audio.")
    return bytes(audio)


# ---------------------------------------------------------------------------
# Spoken-answer shortening
# ---------------------------------------------------------------------------

_CODE_FENCE = re.compile(r"```.*?```", re.DOTALL)
_IMAGE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
_MARKDOWN_LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")
_URL = re.compile(r"https?://\S+")
_HTML_TAG = re.compile(r"<[^>]+>")
_HEADING = re.compile(r"(?m)^\s{0,3}#{1,6}\s*")
_BULLET = re.compile(r"(?m)^\s*(?:[-*+•]|\d+[.)])\s+")
_TABLE_RULE = re.compile(r"(?m)^\s*\|?[\s:|-]{3,}\|?\s*$")
_EMPHASIS = re.compile(r"(\*\*|__|\*|_|~~|`)")
_MULTI_SPACE = re.compile(r"\s+")
_CURRENCIES = {"₹": "rupees", "$": "dollars", "€": "euros", "£": "pounds"}


def _normalise_currency(text: str) -> str:
    for symbol, word in _CURRENCIES.items():
        text = re.sub(
            rf"{re.escape(symbol)}\s*([0-9][0-9,]*(?:\.[0-9]+)?)",
            lambda match, spoken=word: f"{match.group(1).replace(',', '')} {spoken}",
            text,
        )
        text = text.replace(symbol, f" {word} ")

    for abbreviation in ("Rs.", "Rs", "INR"):
        text = re.sub(
            rf"\b{re.escape(abbreviation)}\s*([0-9][0-9,]*(?:\.[0-9]+)?)",
            lambda match: f"{match.group(1).replace(',', '')} rupees",
            text,
            flags=re.IGNORECASE,
        )

    # Keep only thousands separators inside plain numbers, then drop the comma.
    text = re.sub(r"(?<=\d),(?=\d{3}(?:\D|$))", "", text)
    return text


def _clean_for_speech(answer: str) -> str:
    text = _CODE_FENCE.sub(" ", answer or "")
    text = _IMAGE.sub(" ", text)
    text = _MARKDOWN_LINK.sub(r"\1", text)
    text = _URL.sub(" ", text)
    text = _HTML_TAG.sub(" ", text)
    text = _HEADING.sub("", text)
    text = _TABLE_RULE.sub("", text)
    text = _BULLET.sub("", text)
    text = _EMPHASIS.sub("", text)
    text = _normalise_currency(text)
    text = re.sub(r"\s*[—–]\s*", ", ", text)
    text = re.sub(r"(\d+(?:\.\d+)?)\s*%", r"\1 percent", text)
    text = re.sub(r"(\d+(?:\.\d+)?)\s*/\s*5\b", r"\1 out of 5", text)
    text = text.replace("&", " and ")
    text = _MULTI_SPACE.sub(" ", text)
    return text.strip()


def _truncate_for_speech(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text

    clipped = text[:limit].rstrip()
    if clipped.endswith((".", "!", "?")):
        return clipped

    last_sentence = max(
        clipped.rfind(". "),
        clipped.rfind("! "),
        clipped.rfind("? "),
    )
    if last_sentence >= limit // 2:
        return clipped[: last_sentence + 1].strip()

    last_space = clipped.rfind(" ")
    if last_space > 0:
        clipped = clipped[:last_space]
    return clipped.rstrip(" ,;:-—–") + "."


def make_spoken_answer(answer: str, max_chars: int = MAX_SPOKEN_CHARS) -> str:
    """Turn a long, markdown-heavy RAG answer into a short spoken version."""
    cleaned = _clean_for_speech(answer)
    if not cleaned:
        return ""
    return _truncate_for_speech(cleaned, max_chars)
