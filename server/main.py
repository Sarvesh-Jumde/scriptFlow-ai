from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv
from langchain_groq import ChatGroq
# from langchain_ollama import OllamaLLM, OllamaEmbeddings
# from langchain_chroma import Chroma
# from langchain_google_genai import ChatGoogleGenerativeAI
# from langchain_community.vectorstores import Chroma
import os

load_dotenv()
app = FastAPI()

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# GROQ SETUP
groq_key = os.getenv("GROQ_API_KEY")
model_name = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
llm = ChatGroq(api_key=groq_key, model=model_name, temperature=0.7)


# OLLAMA SETUP
# ollama_url = os.getenv("OLLAMA_HOST", "http://localhost:11434")
# embeddings = OllamaEmbeddings(model="llama3")
# vector_db = Chroma(persist_directory="./story_db", embedding_function=embeddings)
# llm = OllamaLLM(model="llama3")

# Initialize Vector DB
# The vector DB and embedding configuration are commented out for now
# to keep the server focused on calling the Gemini model. Re-enable when
# you want to restore contextual retrieval.
# vector_db = Chroma(persist_directory="./story_db", embedding_function=embeddings)

@app.get("/")
def home():
    return {"message": "ScriptFlow-AI Server is Online"}

# @app.post("/add_lore")
# async def add_lore(fact: str):   
#     # """Save a character trait or plot point to the Story Bible."""
#     # vector_db.add_texts([fact])  
#     # return {"message": "Lore saved to Story Bible"}

@app.post("/generate_with_context")
async def generate_with_context(prompt: str):
    # """Retrieve relevant lore before generating the script."""
    # Search DB for the 2 most relevant past facts
    # docs= vector_db.similarity_search(prompt, k=2)
    # context = "\n".join([d.page_content for d in docs])
    
    # Create a combined prompt
    # enriched_prompt = f"Context from Story Bible:\n{context}\n\nTask:{prompt}"
    
    try:
        response = llm.invoke(prompt)
        return {"script": response}
    except Exception as e:
        # Surface a clear error message to the caller and log the original exception.
        raise HTTPException(status_code=500, detail=str(e))