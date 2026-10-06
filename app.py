import os
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
LLM_BASE_URL = "https://api.groq.com/openai"

app = FastAPI(title="Jarvis — assistente pessoal")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=12000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)
    tracker_context: str = Field(default="[]", max_length=12000)


@app.get("/")
async def home():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/manifest.webmanifest")
async def manifest():
    return FileResponse(STATIC_DIR / "manifest.webmanifest", media_type="application/manifest+json")


@app.get("/service-worker.js")
async def service_worker():
    return FileResponse(STATIC_DIR / "service-worker.js", media_type="application/javascript")


async def generate_reply(messages: list[ChatMessage], tracker_context: str = "[]") -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="A chave do serviço de IA ainda não está configurada no ambiente (GROQ_API_KEY).",
        )

    payload = {
        "model": os.getenv("LLM_MODEL", "openai/gpt-oss-120b"),
        "messages": [
            {
                "role": "system",
                "content": f"Você é Jarvis, um assistente pessoal prestativo, criativo e objetivo. Responda em português brasileiro, com tom casual, acolhedor e natural. Seja claro e útil. O Rastreador atual do usuário está em JSON: {tracker_context}. Use apenas esses dados para responder perguntas sobre itens rastreados; não afirme que alterou dados, pois alterações pelo chat são feitas por comandos locais.",
            },
            *[message.model_dump() for message in messages],
        ],
        "temperature": 0.7,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"{LLM_BASE_URL}/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
        )
    if response.is_error:
        raise HTTPException(status_code=502, detail="Não consegui falar com a IA agora. Tente de novo em instantes.")
    try:
        return response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(status_code=502, detail="A resposta da IA veio num formato inesperado.") from None


@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        answer = await generate_reply(request.messages, request.tracker_context)
    except HTTPException:
        raise
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="A conexão com a IA falhou. Tente novamente.") from None
    return {"reply": answer}
