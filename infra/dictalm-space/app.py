import os
import re

from fastapi import FastAPI, HTTPException, Request
from llama_cpp import Llama

API_KEY = os.environ["API_KEY"]  # set as a Space secret, never hardcoded
MODEL_PATH = "/app/model/DictaLM-3.0-1.7B-Thinking-Q4_K_M.gguf"

app = FastAPI()
llm = Llama(model_path=MODEL_PATH, n_ctx=4096, n_threads=2, verbose=False)

# The 1.7B model was initialized from Qwen3-1.7B-Base, which wraps its
# reasoning in <think>...</think> before the actual answer - strip that so
# callers get a clean response body, same contract a plain instruct model
# would return.
THINK_TAG = re.compile(r"<think>.*?</think>", re.DOTALL)


@app.post("/generate")
async def generate(request: Request):
    if request.headers.get("authorization") != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    body = await request.json()
    system = body.get("system", "")
    prompt = body.get("prompt", "")
    if not prompt:
        raise HTTPException(status_code=400, detail="Missing 'prompt'")

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    result = llm.create_chat_completion(messages=messages, max_tokens=2048, temperature=0.7)
    text = result["choices"][0]["message"]["content"]
    text = THINK_TAG.sub("", text).strip()

    return {"content": text}


@app.get("/health")
async def health():
    return {"status": "ok"}
