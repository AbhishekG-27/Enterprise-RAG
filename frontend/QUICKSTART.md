# Quick Start Guide

Follow these steps to get your RAG Document Assistant running:

## Step 1: Setup Backend (FastAPI)

1. **Add CORS to your backend** - See `CORS_SETUP.md` for details

2. **Start your backend:**
   ```bash
   # In your backend directory
   python main.py
   ```

3. **Verify backend is running:**
   - Open http://localhost:8000/docs
   - You should see the FastAPI Swagger documentation

## Step 2: Setup Frontend (Next.js)

1. **Navigate to frontend directory:**
   ```bash
   cd rag-frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   cp .env.local.example .env.local
   ```

4. **Start the frontend:**
   ```bash
   npm run dev
   ```

5. **Open the application:**
   - Navigate to http://localhost:3000

## Step 3: Test the Application

1. **Upload a PDF:**
   - Click the upload area
   - Select a PDF file
   - Click "Upload PDF"
   - Wait for success message

2. **Ask a question:**
   - Select "All Documents" or a specific document
   - Type a question in the text area
   - Click "Ask Question"
   - View the AI-generated answer and sources

## Troubleshooting

### Backend won't start
- Check if port 8000 is already in use
- Verify all Python dependencies are installed
- Check if Qdrant is running on port 6333
- Ensure Ollama is running with llama3.2 model

### Frontend won't start
- Run `npm install` again
- Delete `node_modules` and `.next` folders, then reinstall
- Check Node.js version (must be 18+)

### CORS Errors
- Add CORS middleware to your backend (see `CORS_SETUP.md`)
- Restart your backend after adding CORS
- Clear browser cache

### Upload fails
- Check backend logs for errors
- Verify file is a valid PDF
- Check if `uploaded_pdfs` directory exists

### Query doesn't return results
- Ensure you've uploaded at least one PDF
- Check if embeddings were created (backend logs)
- Verify Ollama is running: `ollama list`

## System Requirements

- **Backend:**
  - Python 3.8+
  - Qdrant running on localhost:6333
  - Ollama with llama3.2 model

- **Frontend:**
  - Node.js 18+
  - npm or yarn

## Next Steps

Once everything is working:

1. **Upload multiple PDFs** to test multi-document search
2. **Try different questions** to test the RAG system
3. **Check source citations** to verify accuracy
4. **Experiment with different documents** to see how it handles various content types

## Need Help?

- Check `README.md` for detailed documentation
- Review `CORS_SETUP.md` for CORS configuration
- Look at backend logs for API errors
- Check browser console for frontend errors
