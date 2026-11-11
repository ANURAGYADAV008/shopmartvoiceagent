#!/usr/bin/env python3
"""Smoke-test the ShopSmart voice endpoints without a frontend.

Examples:
    python scripts/test_voice.py --base-url http://localhost:8002
    python scripts/test_voice.py --audio clip.webm
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import sys
import uuid
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_TTS_TEXT = (
    "I found three wireless headphones under 2000 rupees. "
    "The first one has a four point two star rating."
)

_AUDIO_CONTENT_TYPES = {
    ".wav": "audio/wav",
    ".webm": "audio/webm",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
}


class SmoketestError(RuntimeError):
    pass


def _print_json(label: str, payload: Any) -> None:
    print(f"\n{label}:")
    print(json.dumps(payload, indent=2, ensure_ascii=True))


def _url(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}{path}"


def _open(request: Request, timeout: float) -> tuple[int, str, bytes]:
    try:
        with urlopen(request, timeout=timeout) as response:
            return (
                response.status,
                response.headers.get("Content-Type", ""),
                response.read(),
            )
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SmoketestError(f"HTTP {exc.code} from {request.full_url}: {body}") from exc
    except URLError as exc:
        raise SmoketestError(
            f"Could not reach {request.full_url}: {exc.reason}. Is the API running?"
        ) from exc


def get_json(base_url: str, path: str, timeout: float) -> Any:
    status, _, body = _open(Request(_url(base_url, path)), timeout)
    if status >= 400:
        raise SmoketestError(f"HTTP {status} from {path}: {body!r}")
    return json.loads(body)


def post_json(base_url: str, path: str, payload: dict, timeout: float) -> tuple[str, bytes]:
    request = Request(
        _url(base_url, path),
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "audio/mpeg"},
        method="POST",
    )
    status, content_type, body = _open(request, timeout)
    if status >= 400:
        raise SmoketestError(f"HTTP {status} from {path}: {body.decode('utf-8', 'replace')}")
    return content_type, body


def _multipart(
    fields: dict[str, str],
    file_field: str,
    filename: str,
    file_bytes: bytes,
) -> tuple[bytes, str]:
    boundary = f"----shopmart-{uuid.uuid4().hex}"
    chunks: list[bytes] = []

    for name, value in fields.items():
        chunks.append(
            (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
                f"{value}\r\n"
            ).encode("utf-8")
        )

    content_type = _AUDIO_CONTENT_TYPES.get(
        Path(filename).suffix.lower(),
        mimetypes.guess_type(filename)[0] or "application/octet-stream",
    )
    chunks.append(
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'
            f"Content-Type: {content_type}\r\n\r\n"
        ).encode("utf-8")
    )
    chunks.append(file_bytes)
    chunks.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))

    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def post_multipart(
    base_url: str,
    path: str,
    fields: dict[str, str],
    file_field: str,
    filename: str,
    file_bytes: bytes,
    timeout: float,
) -> Any:
    body, content_type = _multipart(fields, file_field, filename, file_bytes)
    request = Request(
        _url(base_url, path),
        data=body,
        headers={"Content-Type": content_type},
        method="POST",
    )
    status, _, response_body = _open(request, timeout)
    if status >= 400:
        raise SmoketestError(
            f"HTTP {status} from {path}: {response_body.decode('utf-8', 'replace')}"
        )
    return json.loads(response_body)


def run(args: argparse.Namespace) -> int:
    audio_path = Path(args.audio) if args.audio else None
    if audio_path and not audio_path.is_file():
        raise SmoketestError(f"Audio file not found: {audio_path}")

    if not args.skip_health:
        health = get_json(args.base_url, "/voice/health", args.timeout)
        _print_json("GET /voice/health", health)
        if not health.get("configured"):
            print(
                "\nVoice is NOT configured. Set GNANI_API_KEY and restart the API "
                "to exercise STT/TTS.",
                file=sys.stderr,
            )

    if not args.skip_tts:
        content_type, audio = post_json(
            args.base_url,
            "/voice/speak",
            {"text": args.tts_text},
            args.timeout,
        )
        _print_json(
            "POST /voice/speak",
            {
                "content_type": content_type,
                "bytes": len(audio),
                "saved_to": "speech.mp3",
            },
        )
        Path("speech.mp3").write_bytes(audio)

    if audio_path:
        audio_bytes = audio_path.read_bytes()
        fields = {
            "thread_id": args.thread_id,
            "language_code": args.language_code,
        }

        if not args.skip_stt:
            transcribed = post_multipart(
                args.base_url,
                "/voice/transcribe",
                {"language_code": args.language_code},
                "file",
                audio_path.name,
                audio_bytes,
                args.timeout,
            )
            _print_json("POST /voice/transcribe", transcribed)

        if not args.skip_chat:
            chat = post_multipart(
                args.base_url,
                "/voice/chat",
                fields,
                "file",
                audio_path.name,
                audio_bytes,
                args.timeout,
            )
            audio_b64 = chat.pop("audio_base64", None)
            if audio_b64:
                Path("voice_chat.mp3").write_bytes(base64.b64decode(audio_b64))
                chat["audio_saved_to"] = "voice_chat.mp3"
            else:
                chat["audio_saved_to"] = None
            _print_json("POST /voice/chat", chat)
    elif not args.skip_stt or not args.skip_chat:
        print(
            "\nNo --audio provided; skipping /voice/transcribe and /voice/chat. "
            "Pass e.g. --audio clip.webm to test them.",
            file=sys.stderr,
        )

    print("\nVoice smoke test completed.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default="http://localhost:8002",
        help="API base URL (default: http://localhost:8002)",
    )
    parser.add_argument(
        "--audio",
        help="Audio file to send to /voice/transcribe and /voice/chat",
    )
    parser.add_argument("--thread-id", default="test-1", help="Thread ID for /voice/chat")
    parser.add_argument(
        "--language-code", default="en-IN", help="Language code (default: en-IN)"
    )
    parser.add_argument("--tts-text", default=DEFAULT_TTS_TEXT, help="Text for /voice/speak")
    parser.add_argument("--timeout", type=float, default=120.0, help="HTTP timeout in seconds")
    parser.add_argument("--skip-health", action="store_true", help="Skip /voice/health")
    parser.add_argument("--skip-tts", action="store_true", help="Skip /voice/speak")
    parser.add_argument("--skip-stt", action="store_true", help="Skip /voice/transcribe")
    parser.add_argument("--skip-chat", action="store_true", help="Skip /voice/chat")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return run(args)
    except SmoketestError as exc:
        print(f"\nFAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
