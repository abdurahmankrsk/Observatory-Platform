"""
Translate router — POST /api/translate.

Free machine translation for free-text UI content (object descriptions and fun
facts). Object names and scientific units are left untranslated by the caller.
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.translation_service import translate_batch

router = APIRouter(prefix="/api", tags=["translate"])


class TranslateRequest(BaseModel):
    texts: list[str] = Field(default_factory=list, description="Strings to translate")
    target: str = Field("en", description="Target language code, e.g. 'bs'")
    source: str = Field("en", description="Source language code")


class TranslateResponse(BaseModel):
    # original text → translated text
    translations: dict[str, str]


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    """Translate a batch of strings. Fails open: untranslatable strings come back
    unchanged, so the client can always render something."""
    translations = await translate_batch(req.texts, target=req.target, source=req.source)
    return TranslateResponse(translations=translations)
