from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
import os
from uuid import uuid4
from datetime import datetime
from pydantic import BaseModel

load_dotenv()
app = FastAPI()

# allow the Angular client to hit us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# GROQ SETUP – primary LLM for generation
groq_key = os.getenv("GROQ_API_KEY")
model_name = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
llm = ChatGroq(api_key=groq_key, model=model_name, temperature=0.7)

# VECTOR DB / CHROMA SETUP – for lore storage & retrieval
ollama_url = os.getenv("OLLAMA_HOST", "http://localhost:11434")
embeddings = OllamaEmbeddings(model="llama3")
vector_db = Chroma(persist_directory="./story_db", embedding_function=embeddings)

# in‑memory cache of metadata to support recent‑lore endpoint
lore_entries: list[dict] = []


# request/response models
class LorePayload(BaseModel):
    fact: str


class GeneratePayload(BaseModel):
    prompt: str

@app.get("/")
def home():
    return {"message": "ScriptFlow-AI Server is Online"}

@app.post("/lore")
async def add_lore(payload: LorePayload):
    """Store new lore in both the in‑memory list and the Chroma store."""
    fact = payload.fact.strip()
    if not fact:
        raise HTTPException(status_code=400, detail="`fact` field is required")

    metadata = {"id": str(uuid4()), "timestamp": datetime.utcnow().isoformat(), "fact": fact}
    lore_entries.append({"id": metadata["id"], "fact": fact, "timestamp": metadata["timestamp"]})
    vector_db.add_texts([fact], metadatas=[metadata])
    try:
        vector_db.persist()
    except Exception:
        pass
    return lore_entries[-1]

@app.get("/lore/recent")
def get_recent_lore(limit: int = 10):
    """Return the newest `limit` lore facts."""
    return lore_entries[-limit:][::-1]

# simple legacy generation route – just echo back the llm output
@app.post("/generate_with_context")
async def generate_with_context(payload: GeneratePayload):
    prompt = payload.prompt
    try:
        output = llm.invoke(prompt)
        # ChatGroq returns an object with `content` property; convert to string
        text = getattr(output, "content", None) or str(output)
        return {"scene": text, "context_used": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# RAG‑enabled route – uses the vector store to enrich the prompt
@app.post("/generate")
async def generate(payload: GeneratePayload):
    prompt = payload.prompt
    docs = vector_db.similarity_search(prompt, k=2)
    context = "\n".join([d.page_content for d in docs])
    enriched = f"Context from Story Bible:\n{context}\n\nTask:{prompt}"
    try:
        output = llm.invoke(enriched)
        text = getattr(output, "content", None) or str(output)
        used = [d.metadata.get("fact") for d in docs]
        return {"scene": text, "context_used": used}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))