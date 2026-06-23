"""
indexer.py — LlamaIndex PDF ingestion + FAISS vector store for ExaBot
Using OpenAI LLM + Embeddings.
"""

import os
import faiss
from pathlib import Path
from dotenv import load_dotenv

from llama_index.core import VectorStoreIndex, StorageContext, load_index_from_storage
from llama_index.readers.file import PDFReader
from llama_index.vector_stores.faiss import FaissVectorStore
from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core import Settings

load_dotenv()

# ── OpenAI setup ───────────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set. Add it to backend/.env or your environment.")

Settings.llm = OpenAI(
    model="gpt-4o",
    api_key=OPENAI_API_KEY,
    temperature=0.2,
)

Settings.embed_model = OpenAIEmbedding(
    model="text-embedding-ada-002",
    api_key=OPENAI_API_KEY,
)

# ── Constants ─────────────────────────────────────────────────
INDEX_STORE_PATH = Path("./index_store")
EMBEDDING_DIM    = 1536  # OpenAI text-embedding-ada-002 output dimension

# ── In-memory state ───────────────────────────────────────────
_index: VectorStoreIndex | None = None
_indexed_filename: str = ""


def get_status() -> dict:
    return {"indexed": _index is not None, "filename": _indexed_filename}


def build_index(pdf_path: str, filename: str) -> dict:
    """
    Ingest a PDF, build FAISS-backed VectorStoreIndex, persist to disk.
    Returns {pages, filename}.
    """
    global _index, _indexed_filename

    # Delete old index if it exists (dimension may differ from previous run)
    if INDEX_STORE_PATH.exists():
        import shutil
        shutil.rmtree(INDEX_STORE_PATH)

    reader = PDFReader()
    documents = reader.load_data(file=Path(pdf_path))

    faiss_index    = faiss.IndexFlatL2(EMBEDDING_DIM)
    vector_store   = FaissVectorStore(faiss_index=faiss_index)
    storage_ctx    = StorageContext.from_defaults(vector_store=vector_store)

    _index = VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_ctx,
        show_progress=False,
    )

    INDEX_STORE_PATH.mkdir(parents=True, exist_ok=True)
    _index.storage_context.persist(persist_dir=str(INDEX_STORE_PATH))

    _indexed_filename = filename
    return {"pages": len(documents), "filename": filename}


def load_persisted_index() -> bool:
    """Try to reload a previously persisted FAISS index from disk."""
    global _index, _indexed_filename

    faiss_path = INDEX_STORE_PATH / "default__vector_store.json"
    if not INDEX_STORE_PATH.exists() or not faiss_path.exists():
        return False

    try:
        faiss_index  = faiss.IndexFlatL2(EMBEDDING_DIM)
        vector_store = FaissVectorStore(faiss_index=faiss_index)
        storage_ctx  = StorageContext.from_defaults(
            vector_store=vector_store,
            persist_dir=str(INDEX_STORE_PATH),
        )
        _index = load_index_from_storage(storage_ctx)
        _indexed_filename = "resume.pdf (cached)"
        return True
    except Exception as e:
        print(f"[indexer] Could not reload persisted index: {e}")
        return False


def query(question: str) -> dict:
    """Query the index. Returns {answer, sources}."""
    if _index is None:
        raise RuntimeError("No index loaded. Please upload a PDF first.")

    engine   = _index.as_query_engine(similarity_top_k=4, streaming=False)
    response = engine.query(question)

    sources = []
    if hasattr(response, "source_nodes"):
        for node in response.source_nodes[:3]:
            text = node.node.get_content()[:200].replace("\n", " ").strip()
            sources.append({"text": text, "score": round(float(node.score or 0), 3)})

    return {"answer": str(response), "sources": sources}
