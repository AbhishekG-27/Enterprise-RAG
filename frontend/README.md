# RAG Document Assistant - Frontend

A modern Next.js frontend for your RAG (Retrieval Augmented Generation) PDF Question-Answering system.

## Features

- 📄 **PDF Upload** - Upload PDF documents with drag-and-drop support
- 📚 **Document Management** - View and select from your uploaded documents
- 🔍 **Smart Search** - Query specific documents or search across all files
- 💬 **AI Answers** - Get AI-generated answers with source citations
- 🎨 **Modern UI** - Clean, responsive design with Tailwind CSS

## Prerequisites

- Node.js 18+ installed
- Backend API running on `http://localhost:8000` (your FastAPI backend)

## Installation

1. **Navigate to the frontend directory:**
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

4. **Update `.env.local` if your backend runs on a different URL:**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

## Running the Application

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### 1. Upload a PDF
- Click the upload area or drag-and-drop a PDF file
- Wait for the upload to complete (you'll see a success message)

### 2. Select a Document
- Choose "All Documents" to search across all uploaded files
- Or select a specific document to query only that file

### 3. Ask Questions
- Type your question in the text area
- Click "Ask Question" to get an AI-generated answer
- View the answer along with relevant source excerpts

## Project Structure

```
rag-frontend/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main page
│   └── globals.css         # Global styles
├── components/
│   ├── FileUpload.tsx      # PDF upload component
│   ├── FileList.tsx        # Document list component
│   └── QueryInterface.tsx  # Query/answer component
├── lib/
│   └── api.ts             # API utility functions
├── .env.local.example     # Environment variables template
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## API Integration

The frontend communicates with your FastAPI backend using these endpoints:

- `POST /upload_pdf` - Upload PDF files
- `GET /list_files` - Get list of uploaded documents
- `POST /query_file` - Query documents and get AI answers

## Customization

### Change Colors
Edit `tailwind.config.js` to customize the color scheme:

```js
theme: {
  extend: {
    colors: {
      primary: '#your-color',
    }
  }
}
```

### Adjust Query Parameters
Modify `lib/api.ts` to change default values:

```typescript
export const queryFile = async (
  query: string,
  k: number = 5,  // Change number of results
  fileUuid?: string
): Promise<QueryResponse> => {
  // ...
}
```

## Building for Production

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Start the production server:**
   ```bash
   npm start
   ```

## Troubleshooting

### Backend Connection Issues
- Ensure your FastAPI backend is running on `http://localhost:8000`
- Check CORS settings in your backend if you get CORS errors
- Verify the `NEXT_PUBLIC_API_URL` in `.env.local`

### PDF Upload Fails
- Check file size limits in your backend
- Ensure the file is a valid PDF
- Check backend logs for error details

### Styling Issues
- Run `npm run dev` to ensure Tailwind is processing
- Clear browser cache
- Check for console errors

## Technologies Used

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Axios** - HTTP requests
- **Lucide React** - Icons

## License

MIT

## Support

For issues or questions, please check:
1. Backend logs for API errors
2. Browser console for frontend errors
3. Network tab for failed requests
