# Butterfly

Butterfly is a full-stack Western blot optimisation assistant. It is moving from a simple workflow tracker toward an evidence-weighted strategy tool that combines protein intelligence, antibody compatibility, experiment logging, and final image integrity review.

## What It Does

- Pulls protein intelligence from UniProt, AlphaFold DB, and EBI Proteins.
- Predicts transfer, blocking, washing, antibody, and ECL strategy.
- Checks primary/secondary antibody compatibility from product URLs or manual host/isotype/conjugate fields.
- Logs experiment runs so repeat experiments can inform future recommendations.
- Screens final blot images for saturation, background, asymmetry, and integrity risks.

## Stack

- Frontend: React served as static assets from FastAPI
- Backend: FastAPI
- Image analysis: Pillow + NumPy
- Persistence: SQLite for demo/local history

## Run Locally

```bash
python3 run.py
```

Then open:

```txt
http://127.0.0.1:8000
```

If your system Python is unavailable, use the bundled Codex runtime:

```bash
/Users/meenaali/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 run.py
```

Or use the launcher:

```bash
./start_butterfly.sh
```

The local demo is password protected. Unless you set your own password, use:

```txt
butterfly-demo
```

To choose a different local password:

```bash
BUTTERFLY_PASSWORD="your-private-password" python3 run.py
```

## Deploy On Render

1. Push this folder to a GitHub repository.
2. Create a Render account.
3. Click `New` then `Blueprint`.
4. Connect the GitHub repository.
5. Render will read [render.yaml](/Users/meenaali/Documents/Codex/2026-04-18-i-am-trying-to-build-an/render.yaml).
6. Deploy the service.

Before sharing the Render link, add these Render environment variables:

- `BUTTERFLY_PASSWORD`: the private password people must enter to open Butterfly.
- `BUTTERFLY_SECRET`: a long random phrase used to sign login cookies.
- `BUTTERFLY_COOKIE_SECURE`: set to `true` on Render so the login cookie is HTTPS-only.
- `OPENAI_API_KEY`: optional, enables live multimodal AI image interpretation.
- `OPENAI_VISION_MODEL`: optional, defaults to `gpt-4.1-mini`.
- `OPENAI_TEXT_MODEL`: optional, defaults to `gpt-4.1-mini` for Ask Butterfly grounded responses.

## Ask Butterfly Docs

Butterfly can now index uploaded `.pdf`, `.txt`, and `.md` files for grounded retrieval.

Recommended first uploads:

- lab Western blot protocols
- blocking and washing guides
- antibody datasheets
- troubleshooting notes
- transfer system instructions

The side panel will chunk these documents and use them in Ask Butterfly responses.

## Vector RAG

Butterfly now supports a ChromaDB-backed semantic retrieval layer.

- If `chromadb` is installed, uploaded chunks and built-in troubleshooting knowledge are indexed into a persistent local vector store.
- If `OPENAI_API_KEY` is set, embeddings can use OpenAI.
- If no embedding API is configured, Butterfly falls back to a local hashed embedding so retrieval still works.

Optional environment variable:

- `OPENAI_EMBED_MODEL`: defaults to `text-embedding-3-small`

Render will run:

```bash
python3 -m venv .venv && .venv/bin/python -m pip install --upgrade pip && .venv/bin/python -m pip install -r requirements.txt
bash start_render.sh
```

The app uses the hosting provider's `PORT` environment variable automatically.

## Manual Render Setup

If you create a Render `Web Service` manually:

- Runtime: `Python`
- Build command: `python3 -m venv .venv && .venv/bin/python -m pip install --upgrade pip && .venv/bin/python -m pip install -r requirements.txt`
- Start command: `bash start_render.sh`
- Python version: `3.12.7`

## API Endpoints

- `GET /api/health`
- `POST /api/protein-intelligence`
- `POST /api/antibody-compatibility`
- `POST /api/analyze`
- `POST /api/recommendations`
- `GET /api/experiments`
- `GET /api/experiments/{id}`
- `POST /api/experiments`
- `PUT /api/experiments/{id}`

## Demo Limitations

- SQLite history is fine for a demo but not ideal for production persistence.
- Uploaded images are analysed in memory and not permanently stored.
- Vendor product pages may block scraping or change their layout.
- Recommendations are heuristic and should be treated as decision support, not validated scientific instructions.

## Pilot Testing

The current frozen pilot version is tagged in Git as:

- `butterfly-pilot-v1`

Pilot documents in this repository:

- [PILOT_TESTING_GUIDE.md](/Users/meenaali/Documents/Codex/2026-04-18-i-am-trying-to-build-an/PILOT_TESTING_GUIDE.md)
- [PILOT_FEEDBACK_FORM.md](/Users/meenaali/Documents/Codex/2026-04-18-i-am-trying-to-build-an/PILOT_FEEDBACK_FORM.md)

## Best Production Upgrades

1. Replace SQLite with Postgres.
2. Add user login and experiment ownership.
3. Store uploaded images in object storage.
4. Add PubMed / Europe PMC protocol extraction.
5. Add a curated antibody compatibility database.
6. Add lane-aware band quantification.
