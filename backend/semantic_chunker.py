from typing import List
from langchain_community.document_loaders import PyPDFLoader
from langchain_experimental.text_splitter import SemanticChunker
from langchain_community.embeddings import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-mpnet-base-v2",
    model_kwargs={'device': 'cpu'},
)

def semantic_chunker(file_path: str) -> List[dict]:
    # Load PDF
    loader = PyPDFLoader(file_path, extract_images=True)
    docs = loader.load()
    
    # Initialize SemanticChunker with your existing embeddings
    text_splitter = SemanticChunker(
        embeddings=embeddings,
        breakpoint_threshold_type="percentile",  # Options: "percentile", "standard_deviation", "interquartile"
        breakpoint_threshold_amount=90,  # 90th percentile - adjust 80-95 for chunk size
        # Higher percentile = fewer breakpoints = larger chunks
        # Lower percentile = more breakpoints = smaller chunks
    )
    
    # Split documents semantically
    chunks = text_splitter.split_documents(docs)
    
    # Format output
    result = []
    for idx, chunk in enumerate(chunks):
        result.append({
            "content": chunk.page_content,
            "metadata": {
                **chunk.metadata,  # Preserves page numbers and source
                "chunk_idx": idx,
                "total_chunks": len(chunks),
                "chunk_method": "semantic"
            }
        })
    
    print(f"Created {len(chunks)} semantic chunks from {len(docs)} pages")
    return result