FROM python:3.11-slim

# llama-cpp-python needs a compiler toolchain if PyPI has no prebuilt wheel
# for this platform.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the quantized Hebrew model into the image so cold starts don't
# re-download ~1.5GB from Hugging Face every time the Space wakes up.
RUN python -c "\
from huggingface_hub import hf_hub_download; \
hf_hub_download( \
    repo_id='dicta-il/DictaLM-3.0-1.7B-Thinking-GGUF', \
    filename='DictaLM-3.0-1.7B-Thinking-Q4_K_M.gguf', \
    local_dir='/app/model' \
)"

COPY app.py .

# HF Spaces (Docker SDK) route external traffic to port 7860 by default.
EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
