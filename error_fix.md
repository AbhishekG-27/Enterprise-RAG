# Fix PDF Upload Error by Switching to PyMuPDFLoader

## Context

The application is experiencing a critical error when uploading large PDFs (15MB+). The error "cannot reshape array of size 391 into shape (309,178,newaxis)" occurs in the `semantic_chunker` function due to a bug in PyPDFLoader's image extraction functionality when processing certain image types embedded in PDFs.

**Current situation:**
- File: `backend/semantic_chunker.py` line 13
- Loader: `PyPDFLoader(file_path, extract_images=True)`
- Impact: Upload fails completely for affected PDFs, blocking users from adding documents
- Root cause: PIL/Pillow array reshaping error in PyPDFLoader when handling Flate/LZW-compressed images

**User requirement:** Switch to an alternative PDF loader that handles images more robustly while maintaining semantic chunking functionality.

## Solution: Migrate to PyMuPDFLoader

Replace PyPDFLoader with PyMuPDFLoader - a more robust, faster PDF processor that handles problematic images gracefully.

**Why PyMuPDFLoader:**
- 5-20x faster than PyPDFLoader for large documents
- Handles corrupted/malformed images without crashing
- No system-level dependencies required (unlike UnstructuredPDFLoader)
- Fully compatible with existing SemanticChunker pipeline
- Widely used in production RAG systems
- Same Document format output - no downstream code changes needed

## Implementation Steps

### 1. Add PyMuPDF Dependency

**File:** `backend/requirements.txt`

Add the following line:
```txt
pymupdf
```

**Installation:**
```bash
cd backend
source venv/Scripts/activate  # Windows Git Bash
pip install pymupdf
```

### 2. Update semantic_chunker.py

**File:** `backend/semantic_chunker.py`

**Change 1 - Line 2 (import statement):**
```python
# OLD:
from langchain_community.document_loaders import PyPDFLoader

# NEW:
from langchain_community.document_loaders import PyMuPDFLoader
```

**Change 2 - Lines 13-14 (loader instantiation):**
```python
# OLD:
loader = PyPDFLoader(file_path, extract_images=True)
docs = loader.load()

# NEW:
loader = PyMuPDFLoader(
    file_path=str(file_path),
    extract_images=False  # Disable images to prevent reshape errors
)
docs = loader.load()
```

**Rationale for extract_images=False:**
- This is a RAG system focused on semantic text chunking
- Images are not indexed in Qdrant or used by the LLM
- Disabling image extraction eliminates the entire class of image-related errors
- Text extraction quality is unaffected

**Optional Enhancement - Add error handling and logging:**
```python
def semantic_chunker(file_path: str) -> List[dict]:
    try:
        loader = PyMuPDFLoader(
            file_path=str(file_path),
            extract_images=False
        )
        docs = loader.load()

        if not docs:
            raise ValueError(f"No content extracted from PDF: {file_path}")

        print(f"Loaded {len(docs)} pages from PDF using PyMuPDFLoader")

    except Exception as e:
        raise ValueError(f"Failed to load PDF {file_path}: {str(e)}")

    # Rest of the function remains unchanged
    text_splitter = SemanticChunker(
        embeddings=embeddings,
        breakpoint_threshold_type="percentile",
        breakpoint_threshold_amount=90,
    )

    chunks = text_splitter.split_documents(docs)

    result = []
    for idx, chunk in enumerate(chunks):
        result.append({
            "content": chunk.page_content,
            "metadata": {
                **chunk.metadata,
                "chunk_idx": idx,
                "total_chunks": len(chunks),
                "chunk_method": "semantic",
                "loader": "PyMuPDFLoader"  # Track loader version
            }
        })

    print(f"Created {len(chunks)} semantic chunks from {len(docs)} pages")
    return result
```

### 3. No Changes Required in main.py

The existing `upload_pdf` endpoint (lines 299-391) will work without modification because:
- PyMuPDFLoader returns the same LangChain `Document` format as PyPDFLoader
- SemanticChunker output format remains identical
- Qdrant indexing logic is unchanged
- Error handling already captures any loader exceptions

## Critical Files Modified

1. **`backend/requirements.txt`** - Add `pymupdf` dependency
2. **`backend/semantic_chunker.py`** - Update import (line 2) and loader instantiation (lines 13-18)

## Verification & Testing

### Phase 1: Smoke Test
After making changes, verify the loader works:
```bash
cd backend
python -c "from langchain_community.document_loaders import PyMuPDFLoader; print('✓ PyMuPDFLoader available')"
```

### Phase 2: Integration Test
1. Start backend: `python main.py`
2. Ensure Qdrant is running on localhost:6333
3. Upload the problematic 15MB PDF via frontend
4. Verify:
   - Upload completes successfully (no reshape error)
   - Chunks are created in Qdrant (check response: `chunks_created` field)
   - Use `/list_files` endpoint to verify file appears with chunk count
   - Query the uploaded document to confirm retrieval works
   - Test conversation flow with multiple messages

### Phase 3: Regression Test
Test with diverse PDF types:
- Small PDFs (< 1MB) - ensure fast processing
- Large PDFs (15MB+) - the original problematic case
- PDFs with many images - should handle gracefully
- PDFs with tables - ensure text extraction quality
- Scanned PDFs - text should still be extracted
- Text-only PDFs - baseline case

**Success criteria:**
- No reshape errors
- Upload success rate 100% for valid PDFs
- Chunk count similar to previous implementation (±10%)
- Query accuracy maintained or improved
- Processing time equal or faster than before

### Phase 4: Performance Benchmark
Compare before/after metrics:
- Upload time for 15MB PDF
- Memory usage during processing
- Number of chunks created
- Query response quality

**Expected improvements:**
- 5-20x faster processing (PyMuPDF benchmark advantage)
- More stable memory usage (no image processing overhead)
- Zero reshape errors

## Rollback Plan

If PyMuPDFLoader causes unexpected issues:

**Quick rollback (< 2 minutes):**
```python
# semantic_chunker.py
from langchain_community.document_loaders import PyPDFLoader

loader = PyPDFLoader(file_path, extract_images=False)  # Keep images disabled
```

This reverts to the old loader but maintains the fix for the reshape error.

## Potential Issues & Mitigations

**Issue 1: Different text extraction format**
- **Symptom:** Chunks have different formatting (spacing, line breaks)
- **Mitigation:** Add text normalization before chunking:
  ```python
  for doc in docs:
      doc.page_content = " ".join(doc.page_content.split())
  ```

**Issue 2: Metadata schema differences**
- **Symptom:** PyMuPDFLoader adds extra metadata fields (creationdate, moddate, producer)
- **Impact:** None - metadata is stored as JSON in Qdrant, extra fields are harmless
- **Mitigation:** No action needed unless specific metadata filtering is required

**Issue 3: PyMuPDF installation fails**
- **Symptom:** `pip install pymupdf` fails
- **Mitigation:**
  - Check Python version (requires 3.8+)
  - Try upgrading pip: `pip install --upgrade pip`
  - Install from conda if using Anaconda: `conda install -c conda-forge pymupdf`

## Alternative Approach (If Images Are Critical)

If you later determine image extraction is necessary for the RAG system:

```python
def semantic_chunker(file_path: str) -> List[dict]:
    try:
        # Try with images first
        loader = PyMuPDFLoader(
            file_path=str(file_path),
            extract_images=True
        )
        docs = loader.load()
        print(f"Successfully loaded {len(docs)} pages with images")
    except Exception as e:
        # Graceful fallback to text-only
        print(f"Warning: Image extraction failed ({str(e)}), falling back to text-only")
        loader = PyMuPDFLoader(
            file_path=str(file_path),
            extract_images=False
        )
        docs = loader.load()

    # Continue with semantic chunking...
```

This provides graceful degradation while maintaining robustness.

## Expected Outcome

**Before:**
- Error: `ValueError: cannot reshape array of size 391 into shape (309,178,newaxis)`
- Upload fails for 15MB+ PDFs with certain image formats
- User sees HTTP 500 error: "Error uploading file: cannot reshape..."

**After:**
- Upload succeeds for all PDF sizes and image types
- 5-20x faster processing for large documents
- Robust error handling with meaningful error messages
- Same or better text extraction quality
- Zero image-related errors

## Summary

This is a surgical, low-risk change that:
- Fixes the immediate reshape error blocking PDF uploads
- Improves performance significantly (5-20x faster)
- Requires minimal code changes (2 lines in semantic_chunker.py + 1 line in requirements.txt)
- Maintains full backward compatibility with existing functionality
- No changes needed to database, Qdrant, or frontend code
- Easy to rollback if issues arise

The implementation is straightforward and can be completed in under 30 minutes including testing.
