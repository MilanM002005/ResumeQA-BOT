# EXCELLENTBOT

AI resume chatbot with a FastAPI backend and local frontend.

## Quick Start

1. Open a terminal and run:
   ```bash
   cd backend
   copy .env.example .env
   pip install -r requirements.txt
   ```
2. Add your OpenAI key to `backend/.env`:
   ```env
   OPENAI_API_KEY=sk-...
   ```
3. Start the server:
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```
4. Open in your browser:
   ```
   http://127.0.0.1:8000
   ```

## What it does

- Upload a PDF resume
- Build a local FAISS index
- Ask questions and get answers from the document

## API Endpoints

- `GET /` — frontend UI
- `GET /status` — index status
- `POST /upload` — upload a PDF
- `POST /chat` — ask a question

## Project layout

- `backend/main.py` — FastAPI server
- `backend/indexer.py` — PDF ingestion and OpenAI integration
- `frontend/index.html` — user interface
- `frontend/app.js` — client chat logic

## Git

Do not commit secrets or generated files. Use the provided `.gitignore`.

## Deploying on Google Cloud

### Option 1: Compute Engine VM (your instance)

1. SSH into your VM.
2. Install Python and Git if needed:
   ```bash
   sudo apt update
   sudo apt install -y python3 python3-venv python3-pip git
   ```
3. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/MilanM002005/ResumeQA-ExaBOT.git
   cd ResumeQA-ExaBOT/backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   ```
4. Add your `OPENAI_API_KEY` to `backend/.env`.
5. Run the app:
   ```bash
   python -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```
6. Open the VM external IP in browser at:
   ```
   http://<VM_EXTERNAL_IP>:8000
   ```
7. Make sure the VM firewall allows port `8000`.

### Option 2: Cloud Run (recommended for safety and ease)

1. Install Google Cloud SDK and authenticate:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
2. Build and deploy:
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/resumeqa-exabot
   gcloud run deploy resumeqa-exabot \
     --image gcr.io/YOUR_PROJECT_ID/resumeqa-exabot \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --port 8080
   ```
3. Set the Cloud Run secret or environment variable `OPENAI_API_KEY` in service settings.
4. Access the URL provided by Cloud Run.

### Notes

- Use `backend/.env.example` as a template.
- Do not store `backend/.env` in Git.
- Cloud Run removes the need to manage VM firewall rules and OS updates.
