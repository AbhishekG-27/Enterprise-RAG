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

ImageFile.LOAD_TRUNCATED_IMAGES = True

# Initialize a FastAPI app
app = FastAPI()

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

def generate_answer(query: str, retrieved_docs: List[Dict]) -> Dict:
    """
    Generate an answer using the LLM based on retrieved documents.
    
    Args:
        query: The user's question
        retrieved_docs: List of retrieved documents from Qdrant
        
    Returns:
        Dict with answer and sources
    """
    # Create context from retrieved documents
    context = "\n\n".join([f"[Source {i+1}]:\n{doc['content']}" for i, doc in enumerate(retrieved_docs)])
    # print(context)
    
    # Create prompt template
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
    
    # Format the prompt
    formatted_prompt = prompt.format(context=context, question=query)
    
    # Generate answer
    answer = llm.invoke(formatted_prompt)
    
    return {
        "answer": answer,
        "sources": [
            {
                "content": doc["content"][:300] + "...",  # Truncate for brevity
                "metadata": doc["metadata"],
                "score": doc["similarity_score"]
            }
            for doc in retrieved_docs
        ],
        "num_sources": len(retrieved_docs)
    }

class QueryRequest(BaseModel):
    query: str
    k: int = 3  # Number of results to return
    file_uuid: Optional[str] = None  # ✅ Optional file filter

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

    # 1. Embed the query
    query_dense = embeddings.embed_query(query_text)

    # "next(...)" gives you a fastembed.SparseEmbedding object (with numpy arrays)
    raw_sparse_output = next(sparse_embedding_model.query_embed(query_text))

    # 2. CONVERT IT (The missing step)
    # Qdrant requires standard Python lists, not numpy arrays
    query_sparse_formatted = models.SparseVector(
        indices=raw_sparse_output.indices.tolist(),
        values=raw_sparse_output.values.tolist()
    )

    # Build query filter
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

    # 2. Hybrid Search using Qdrant's 'prefetch' (The modern way)
    search_result = client.query_points(
        collection_name=collection_name,
        prefetch=[
            # Sub-query 1: Dense Search (Semantic)
            models.Prefetch(
                query=query_dense,
                using="dense",
                limit=10,
                filter=query_filter
            ),
            # Sub-query 2: Sparse Search (Keywords)
            models.Prefetch(
                query=query_sparse_formatted,
                using="sparse",
                limit=10,
                filter=query_filter
            ),
        ],
        # Merge results using RRF
        query=models.FusionQuery(
            fusion=models.Fusion.RRF
        ),
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
    # print(formatted_results)
    
    result = generate_answer(query=query_text, retrieved_docs=formatted_results)
    
    return JSONResponse(
        status_code=200,
        content={
            "query": query_request.query,
            "answer": result["answer"],
            "sources": result["sources"],
            "num_sources": result["num_sources"]
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)