# DictaLM Hebrew server — deployment (one-time, ~15 min)

Runs `DictaLM-3.0-1.7B` (Hebrew-native, open-weight, Apache 2.0) behind a small
authenticated HTTP API, hosted for free on Hugging Face Spaces. No credit card
anywhere in this flow.

## 1. Create a free Hugging Face account
huggingface.co/join — email + password only, no payment method asked.

## 2. Create the Space
huggingface.co/new-space →
- **SDK**: Docker
- **Hardware**: CPU basic · Free
- **Visibility**: Private if your account allows it; Public is fine too — the
  API key below is what actually protects it, not the Space's visibility.

## 3. Add the API key as a Space secret
Space → Settings → **Repository secrets** → New secret:
- Name: `API_KEY`
- Value: any long random string, e.g. generate one with
  `openssl rand -hex 32`. Save it somewhere — you'll need the same value in
  step 5.

## 4. Push these files to the Space
Hugging Face gives each Space its own git remote (shown on the Space's page,
first-time setup box). From this folder:

```bash
git init
git remote add space https://huggingface.co/spaces/<your-username>/<space-name>
git add Dockerfile app.py requirements.txt
git commit -m "Deploy DictaLM Hebrew server"
git push space main
```

The build takes 5-10 minutes (compiles `llama-cpp-python`, downloads the
~1.5GB model into the image). Watch progress under the Space's "Logs" tab.

## 5. Point the Supabase edge function at it
Once the Space shows "Running", its URL is:
`https://<your-username>-<space-name>.hf.space`

```bash
npx supabase secrets set DICTALM_ENDPOINT_URL=https://<your-username>-<space-name>.hf.space
npx supabase secrets set DICTALM_API_KEY=<the value you generated in step 3>
```

Then redeploy the edge function: `npx supabase functions deploy task-studio-ai`.

## Things to know

- **Cold starts**: free Spaces sleep after 48h with no traffic. The first
  request after sleep takes 30-60s (container boot + model load); every
  request after that is normal speed.
- **Quality**: this is a 1.7B model — noticeably weaker than Gemini/Claude on
  nuanced tasks (e.g. misconception diagnosis). It's the tradeoff for
  free + self-hosted + genuinely Hebrew-native. If quality is unacceptable in
  practice, the `dicta-il/DictaLM-3.0-Nemotron-12B-Instruct-GGUF` variant is
  meaningfully stronger but slower on 2 vCPUs, or a paid API becomes the
  better call for this specific feature.
- **No autoscaling, no SLA**: single container, free tier. If it crashes,
  requests to `task-studio-ai` fail until it restarts on the next request.
