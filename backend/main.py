"""
main.py — FastAPI server for EXCELLENTBOT
"""

import os
import uuid
import shutil
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

import indexer

load_dotenv()

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(title="EXCELLENTBOT API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

FRONTEND_DIR = Path("../frontend")


# ── Startup: try to reload persisted index ────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    loaded = indexer.load_persisted_index()
    if loaded:
        print("[startup] OK - Reloaded persisted index from disk.")
    else:
        print("[startup] INFO - No persisted index found. Waiting for PDF upload.")


# ── Models ────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    sources: list[dict]


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/status")
async def status():
    """Return current index status."""
    return indexer.get_status()


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Accept a PDF file, index it with LlamaIndex, return metadata.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    safe_name = f"{uuid.uuid4().hex}_{file.filename}"
    save_path = UPLOAD_DIR / safe_name

    try:
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    finally:
        file.file.close()

    try:
        result = indexer.build_index(str(save_path), file.filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")

    return JSONResponse({
        "status": "success",
        "filename": result["filename"],
        "pages": result["pages"],
        "message": f"Successfully indexed {result['pages']} page(s).",
    })


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    Accept a user question, query the index, return AI answer.
    """
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    try:
        result = indexer.query(req.message)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

    return ChatResponse(reply=result["answer"], sources=result["sources"])


# ── Serve frontend ─────────────────────────────────────────────────────────────
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    async def serve_frontend():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/{path:path}")
    async def serve_frontend_files(path: str):
        file_path = FRONTEND_DIR / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))
