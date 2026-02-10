from langchain_community.llms import Ollama
from semantic_chunker import semantic_chunker
from langchain_classic.prompts import PromptTemplate
from langchain_community.embeddings import HuggingFaceEmbeddings
from pydantic import BaseModel
from typing import List, Dict, Optional
import os, uuid
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import uuid
from pathlib import Path
import shutil
from PIL import ImageFile
from qdrant_client import QdrantClient, models
from qdrant_client.models import PointStruct
from fastembed import SparseTextEmbedding
from fastapi.middleware.cors import CORSMiddleware
from database import (
    init_db, create_conversation, add_message,
    get_conversation_messages, list_conversations, delete_conversation, _conversation_exists
)
from contextlib import asynccontextmanager

ImageFile.LOAD_TRUNCATED_IMAGES = True

# Initialize a FastAPI app

@asynccontextmanager
async def startup(app: FastAPI):
    await init_db()
    print("✅ Database ready!")
    yield  # App runs here

app = FastAPI(lifespan=startup)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure the directory where PDFs will be stored
PDF_STORAGE_DIR = Path("uploaded_pdfs")
PDF_STORAGE_DIR.mkdir(exist_ok=True)

# Initialize the RecursiveCharacterTextSplitter for splitting the pages into chunks
# text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)

# Initializing the HuggingFaceEmbeddings to create embeddings for the created chunks
# Using the sentence transformer
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-mpnet-base-v2",
    model_kwargs={'device': 'cpu'},
)

# Connecting to the Qdrant database and creating a collection
client = QdrantClient(url="http://localhost:6333")
collection_name = "test_collection"
if not client.collection_exists(collection_name=collection_name):
    client.create_collection(
        collection_name=collection_name,
        # 1. Dense Vector Configuration (OpenAI)
        vectors_config={
            "dense": models.VectorParams(
                size=768,  # Matches text-embedding-3-small
                distance=models.Distance.COSINE
            )
        },
        # 2. Sparse Vector Configuration (Keywords/BM25)
        sparse_vectors_config={
            "sparse": models.SparseVectorParams(
                index=models.SparseIndexParams(
                    on_disk=False, # Keep in RAM for speed
                )
            )
        }
    )
    print("Hybrid Collection Created!")

# Initialize the Sparse Embedding Model (Run this once, it downloads a small model)
# "Qdrant/bm25" is a model that mimics BM25 but creates vector-compatible outputs
sparse_embedding_model = SparseTextEmbedding(model_name="Qdrant/bm25")

# Initialize Ollama LLM
llm = Ollama(
    model="llama3.2",  # or "mistral", "phi3"
    temperature=0.7,
)

class QueryRequest(BaseModel):
    query: str
    k: int = 3
    file_uuid: Optional[str] = None
    conversation_id: Optional[str] = None  # ← NEW: ties query to a conversation

class ConversationCreate(BaseModel):
    file_uuid: Optional[str] = None

class MessageResponse(BaseModel):
    role: str
    content: str
    sources: Optional[List[Dict]] = None
    created_at: Optional[str] = None

class ConversationResponse(BaseModel):
    id: str
    title: str
    file_uuid: Optional[str]
    created_at: str
    updated_at: str
    messages: Optional[List[MessageResponse]] = None

def generate_answer(
    query: str,
    retrieved_docs: List[Dict],
    chat_history: Optional[List[Dict]] = None
) -> Dict:
    """
    Generate an answer using the LLM based on retrieved documents and conversation history.

    Args:
        query: The user's current question
        retrieved_docs: List of retrieved documents from Qdrant
        chat_history: List of previous messages [{"role": "human"|"assistant", "content": "..."}]

    Returns:
        Dict with answer and sources
    """
    # Build context from retrieved documents
    context = "\n\n".join(
        [f"[Source {i+1}]:\n{doc['content']}" for i, doc in enumerate(retrieved_docs)]
    )

    # Build conversation history string
    history_str = ""
    if chat_history:
        history_parts = []
        for msg in chat_history:
            role_label = "Human" if msg["role"] == "human" else "Assistant"
            history_parts.append(f"{role_label}: {msg['content']}")
        history_str = "\n".join(history_parts)

    # Build prompt with or without history
    if history_str:
        prompt_template = """You are a helpful assistant that answers questions based on the provided context from a PDF document.

        Context from the document:
        {context}

        Previous conversation:
        {history}

        Current question: {question}

        Instructions:
        - Answer the question based ONLY on the information provided in the context above
        - Use the previous conversation to understand what the user is referring to (pronouns like "it", "that", "this", references like "the second point", etc.)
        - If the answer is not in the context, say "I cannot find this information in the document"
        - Be concise and specific
        - If relevant, mention which source section supports your answer

        Answer:"""
        prompt = PromptTemplate(
            template=prompt_template,
            input_variables=["context", "question", "history"]
        )
        formatted_prompt = prompt.format(
            context=context, question=query, history=history_str
        )
    else:
        prompt_template = """You are a helpful assistant that answers questions based on the provided context from a PDF document.

        Context from the document:
        {context}

        Question: {question}

        Instructions:
        - Answer the question based ONLY on the information provided in the context above
        - If the answer is not in the context, say "I cannot find this information in the document"
        - Be concise and specific
        - If relevant, mention which source section supports your answer

        Answer:"""
        prompt = PromptTemplate(
            template=prompt_template,
            input_variables=["context", "question"]
        )
    formatted_prompt = prompt.format(context=context, question=query)

    # Generate answer
    answer = llm.invoke(formatted_prompt)

    return {
        "answer": answer,
        "sources": [
            {
                "content": doc["content"][:300] + "...",
                "metadata": doc["metadata"],
                "score": doc["similarity_score"]
            }
            for doc in retrieved_docs
        ],
        "num_sources": len(retrieved_docs)
    }

@app.post("/conversations")
async def create_new_conversation(request: ConversationCreate):
    """
    Create a new conversation session.

    WHY a separate endpoint (not auto-created on first query):
    The frontend needs the conversation_id BEFORE the first message is sent,
    so it can associate the conversation with UI state (which chat tab is open,
    which file is selected, etc.). Creating it upfront also lets us set the
    file_uuid at conversation creation time.
    """
    conversation_id = await create_conversation(file_uuid=request.file_uuid)
    return {"conversation_id": conversation_id}


@app.get("/conversations")
async def get_conversations(file_uuid: Optional[str] = None):
    """
    List all conversations, optionally filtered by file.

    WHY: The frontend needs this for a "conversation history" sidebar—showing
    past chat sessions the user can click to resume.
    """
    conversations = await list_conversations(file_uuid=file_uuid)
    return {"conversations": conversations}


@app.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """
    Get a specific conversation with all its messages.

    WHY: When a user clicks on a past conversation in the sidebar, the frontend
    needs to load all messages to render the full chat history.
    """
    messages = await get_conversation_messages(conversation_id)
    if not messages and not await _conversation_exists(conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"conversation_id": conversation_id, "messages": messages}


@app.delete("/conversations/{conversation_id}")
async def remove_conversation(conversation_id: str):
    """
    Delete a conversation and all its messages.

    WHY: Users need to be able to clear their chat history. Also important
    for privacy/data management.
    """
    deleted = await delete_conversation(conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"message": "Conversation deleted"}

@app.get("/list_files")
async def list_files():
    """Get all unique files in the database"""

    scroll_result = client.scroll(
        collection_name="test_collection",
        limit=10000,
        with_payload=True,
        with_vectors=False
    )

    files = {}
    for point in scroll_result[0]:
        file_id = point.payload.get("file_uuid")
        if file_id and file_id not in files:
            files[file_id] = {
                "file_id": file_id,
                "filename": point.payload.get("file_name"),
                "chunks": 0
            }
        if file_id:
            files[file_id]["chunks"] += 1
        
    print(files)
    
    return {
        "total_files": len(files),
        "files": list(files.values())
    }

@app.post("/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    # Validate that the uploaded file is a PDF
    if not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed"
        )
    
    # Verify content type
    if file.content_type != 'application/pdf':
        raise HTTPException(
            status_code=400,
            detail="Invalid content type. Must be application/pdf"
        )
    
    try:
        # Generate a unique UUID for the file
        file_uuid = str(uuid.uuid4())
        
        # Create filename with UUID
        file_path = PDF_STORAGE_DIR / f"{file_uuid}.pdf"
        
        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # loader = PyPDFLoader(file_path, extract_images=True)

        # docs = loader.load()
        # print(f'Number of pages in file: {len(docs)}')

        # texts = text_splitter.split_documents(docs)
        result = semantic_chunker(file_path=file_path)
        # print(result)
        texts_chunk = [text.get("content") for text in result]

        dense_vectors = embeddings.embed_documents(texts=texts_chunk)

        # 2. Generate Sparse Vectors (FastEmbed)
        # This returns a generator, so we convert to list
        sparse_vectors = list(sparse_embedding_model.embed(texts_chunk))

        points = []
        for idx, (text, dense_vec, sparse_vec) in enumerate(zip(texts_chunk, dense_vectors, sparse_vectors)):
            # 3. Create the Point with Named Vectors
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector={
                        "dense": dense_vec,
                        "sparse": models.SparseVector(
                            indices=sparse_vec.indices.tolist(), values=sparse_vec.values.tolist()
                        )
                    },
                    payload={
                        "text": text,
                        "metadata": result[idx].get("metadata"),
                        "file_uuid": file_uuid,
                        "file_name": file.filename,
                        "chunck_idx": idx
                    }
                )
            )

        operation_info = client.upsert(
            collection_name="test_collection",
            wait=True,
            points=points,
        )
        print(operation_info)
        
        return JSONResponse(
            status_code=200,
            content={
                "message": "PDF uploaded successfully",
                "uuid": file_uuid,
                "original_filename": file.filename,
                "file_path": str(file_path),
                "file_size": os.path.getsize(file_path),
                "chunks_created": len(points)
            }
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error uploading file: {str(e)}"
        )
    
    finally:
        # Close the file
        await file.close()
    
@app.post("/query_file")
async def query_file(query_request: QueryRequest):
    query_text = query_request.query
    conversation_id = query_request.conversation_id

    # --- Step A: Session Management ---
    # Auto-create conversation if not provided
    # WHY: Backwards-compatible. Old frontend code that doesn't send
    # conversation_id will still work—each query just creates a new session.
    if not conversation_id:
        conversation_id = await create_conversation(file_uuid=query_request.file_uuid)

    # --- Step B: Load Chat History ---
    # Retrieve last 10 messages (5 human + 5 assistant turns)
    # WHY 10: Balances context quality vs token budget. See Section 7.
    chat_history = await get_conversation_messages(conversation_id, limit=10)

    # --- Step C: Store the Human Message ---
    # WHY store BEFORE generating the answer: If the server crashes mid-generation,
    # we don't lose the user's question. The conversation remains consistent.
    await add_message(conversation_id, "human", query_text)

    # --- Step D: Rewrite Query for Better Retrieval ---
    # WHY: If the user says "tell me more about that", searching Qdrant for
    # "tell me more about that" returns garbage. We use the LLM to rewrite
    # the query into a standalone question using conversation context.
    search_query = await rewrite_query_if_needed(query_text, chat_history)

    # --- Step E: Hybrid Search (same as before, but using rewritten query) ---
    query_dense = embeddings.embed_query(search_query)  # ← uses rewritten query
    raw_sparse_output = next(sparse_embedding_model.query_embed(search_query))
    query_sparse_formatted = models.SparseVector(
        indices=raw_sparse_output.indices.tolist(),
        values=raw_sparse_output.values.tolist()
    )

    query_filter = None
    if query_request.file_uuid:
        query_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="file_uuid",
                    match=models.MatchValue(value=query_request.file_uuid)
                )
            ]
        )

    search_result = client.query_points(
        collection_name=collection_name,
        prefetch=[
            models.Prefetch(query=query_dense, using="dense", limit=10, filter=query_filter),
            models.Prefetch(query=query_sparse_formatted, using="sparse", limit=10, filter=query_filter),
        ],
        query=models.FusionQuery(fusion=models.Fusion.RRF),
        limit=query_request.k,
    )

    formatted_results = []
    for point in search_result.points:
        formatted_results.append({
            "content": point.payload["text"],
            "metadata": point.payload['metadata'],
            "similarity_score": float(point.score),
            "file_uuid": query_request.file_uuid,
            "file_name": point.payload.get("file_name")
        })

    # --- Step F: Generate Answer WITH History ---
    result = generate_answer(
        query=query_text,          # Original query (not rewritten)
        retrieved_docs=formatted_results,
        chat_history=chat_history   # ← NEW: pass conversation history
    )

    # --- Step G: Store the Assistant Message ---
    await add_message(
        conversation_id, "assistant",
        result["answer"],
        sources=result["sources"]
    )

    # --- Step H: Return response WITH conversation_id ---
    return JSONResponse(
        status_code=200,
        content={
            "query": query_request.query,
            "answer": result["answer"],
            "sources": result["sources"],
            "num_sources": result["num_sources"],
            "conversation_id": conversation_id  # ← NEW: frontend stores this
        }
    )

async def rewrite_query_if_needed(
    query: str,
    chat_history: List[Dict]
) -> str:
    """
    Rewrite a follow-up query into a standalone question using conversation context.

    WHY: Vague follow-ups like "tell me more" or "what about that" produce poor
    embeddings for retrieval. Rewriting them into specific standalone questions
    dramatically improves retrieval quality.

    WHY only when history exists: If this is the first message in a conversation,
    there's nothing to contextualize—the query is already standalone.

    WHY use the same LLM: We already have Ollama running. The rewrite prompt is
    short and fast. No need for a separate model.
    """
    if not chat_history:
        return query  # No history → query is already standalone

    # Build a concise history summary (only last 4 messages to keep rewrite prompt small)
    recent_history = chat_history[-4:]
    history_str = "\n".join(
        [f"{'Human' if m['role'] == 'human' else 'Assistant'}: {m['content'][:200]}"
         for m in recent_history]
    )

    rewrite_prompt = f"""Given the following conversation history and a follow-up question, rewrite the follow-up question to be a standalone question that captures the full intent without needing the conversation context.

    If the question is already standalone and clear, return it unchanged.

    Conversation history:
    {history_str}

    Follow-up question: {query}

    Standalone question:"""

    rewritten = llm.invoke(rewrite_prompt).strip()

    # Fallback: if the LLM returns something weird (empty, too long, or looks like
    # a full answer instead of a question), use the original query
    if not rewritten or len(rewritten) > 300 or len(rewritten) < 5:
        return query

    return rewritten

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)