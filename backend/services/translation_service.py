"""
Translation service — free machine translation for object descriptions / fun facts.

Provider is selectable via the TRANSLATE_PROVIDER env var:
  - "mymemory" (default) — https://mymemory.translated.net, no API key. Anonymous
    quota ~5k words/day; set MYMEMORY_EMAIL to raise it to ~50k/day.
  - "lingva"             — a Lingva Translate instance (Google-backed). Set
    LINGVA_URL to your instance (default https://lingva.ml).

Design notes:
  - Fails OPEN: any error/timeout returns the ORIGINAL text so the UI never breaks.
  - Results are cached in-memory (text+target → translation) so the curated catalog
    is effectively translated once, then served instantly.
  - No-op when the target language is English / equals the source.
"""
from __future__ import annotations

import asyncio
import os
import time
from typing import Dict, List, Tuple
from urllib.parse import quote

import httpx

# text+langpair → (translation, timestamp)
_cache: Dict[str, Tuple[str, float]] = {}
CACHE_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days — translations are stable

# MyMemory rejects a single `q` longer than ~500 bytes; skip rather than error.
MAX_LEN = 500
_TIMEOUT = httpx.Timeout(8.0)
# Cap concurrent upstream calls so a big batch can't hammer the free endpoint.
_semaphore = asyncio.Semaphore(5)


def _provider() -> str:
    return os.getenv("TRANSLATE_PROVIDER", "mymemory").lower()


def _cache_key(text: str, target: str, source: str) -> str:
    return f"{_provider()}:{source}|{target}:{text}"


async def _mymemory(client: httpx.AsyncClient, text: str, source: str, target: str) -> str:
    params = {"q": text, "langpair": f"{source}|{target}"}
    email = os.getenv("MYMEMORY_EMAIL")
    if email:
        params["de"] = email
    resp = await client.get("https://api.mymemory.translated.net/get", params=params)
    resp.raise_for_status()
    data = resp.json()
    translated = (data.get("responseData") or {}).get("translatedText")
    # MyMemory echoes warnings/quota messages in this field on failure.
    if not translated or "MYMEMORY WARNING" in translated.upper():
        return text
    return translated


async def _lingva(client: httpx.AsyncClient, text: str, source: str, target: str) -> str:
    base = os.getenv("LINGVA_URL", "https://lingva.ml").rstrip("/")
    url = f"{base}/api/v1/{source}/{target}/{quote(text, safe='')}"
    resp = await client.get(url)
    resp.raise_for_status()
    return resp.json().get("translation") or text


async def _translate_one(client: httpx.AsyncClient, text: str, source: str, target: str) -> str:
    text = (text or "").strip()
    if not text or len(text) > MAX_LEN:
        return text

    key = _cache_key(text, target, source)
    hit = _cache.get(key)
    if hit and time.time() - hit[1] < CACHE_TTL_SECONDS:
        return hit[0]

    async with _semaphore:
        try:
            if _provider() == "lingva":
                out = await _lingva(client, text, source, target)
            else:
                out = await _mymemory(client, text, source, target)
        except Exception:
            out = text  # fail open

    _cache[key] = (out, time.time())
    return out


async def translate_batch(texts: List[str], target: str, source: str = "en") -> Dict[str, str]:
    """
    Translate many strings at once. Returns a {original: translated} map.
    De-duplicates inputs and translates concurrently. A no-op (identity map) when
    the target equals the source or is English.
    """
    uniq = [t for t in {(t or "").strip() for t in texts} if t]
    if not uniq or target == source or target == "en":
        return {t: t for t in uniq}

    async with httpx.AsyncClient(timeout=_TIMEOUT, headers={"User-Agent": "AstroObservatory/1.0"}) as client:
        results = await asyncio.gather(
            *(_translate_one(client, t, source, target) for t in uniq)
        )
    return dict(zip(uniq, results))
