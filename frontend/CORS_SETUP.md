# CORS Setup for Backend

To allow your Next.js frontend to communicate with your FastAPI backend, you need to enable CORS.

## Add CORS Middleware to Your Backend

Add this to your `main.py` file (the FastAPI backend):

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

# Your existing routes...
```

## For Production

If deploying to production, update the `allow_origins` to include your production URL:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Development
        "https://yourdomain.com",  # Production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Install Required Package

If you don't have `fastapi.middleware.cors`, it should already be included with FastAPI. If not:

```bash
pip install fastapi[all]
```

## Complete Backend Setup

Your backend `main.py` should look like this at the top:

```python
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
# ... other imports

app = FastAPI()

# Add CORS middleware - ADD THIS RIGHT AFTER app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ... rest of your code
```

## Testing CORS Setup

1. Start your backend: `python main.py`
2. Start your frontend: `npm run dev`
3. Try uploading a PDF from the frontend
4. If you see CORS errors in the browser console, double-check the CORS middleware configuration
