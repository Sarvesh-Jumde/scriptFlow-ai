#!/usr/bin/env python3
from dotenv import load_dotenv
import os

load_dotenv()

API_KEY = os.getenv("GOOGLE_API_KEY")
print(f"API Key present: {bool(API_KEY)}")
print(f"API Key (first 20 chars): {API_KEY[:20] if API_KEY else 'None'}")

# Test LLM
try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=API_KEY)
    print("✓ LLM initialized successfully")
except Exception as e:
    print(f"✗ LLM error: {e}")

# Test Embeddings with different model names
embedding_models = [
    "embedding-001",
    "models/embedding-001", 
    "text-embedding-004",
    "models/text-embedding-004"
]

from langchain_google_genai import GoogleGenerativeAIEmbeddings

for model in embedding_models:
    try:
        embeddings = GoogleGenerativeAIEmbeddings(model=model, google_api_key=API_KEY)
        # Try to embed a simple text
        result = embeddings.embed_query("test")
        print(f"✓ Embeddings model '{model}' works (dim: {len(result)})")
        break
    except Exception as e:
        print(f"✗ Embeddings model '{model}' failed: {str(e)[:100]}")
