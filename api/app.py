# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
import tempfile
import uuid
from typing import Optional, Dict, List
import asyncio

# Import AIMakerSpace RAG components
from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.embedding import EmbeddingModel

# Initialize FastAPI application with a title
app = FastAPI(title="OpenAI Chat API")

# Global storage for RAG sessions
rag_sessions: Dict[str, VectorDatabase] = {}
embedding_model = None  # Will be initialized when needed

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

# Define the data model for RAG chat requests
class RAGChatRequest(BaseModel):
    session_id: str        # Session identifier for RAG context
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=request.api_key)
        
        # Create an async generator function for streaming responses
        async def generate():
            # Create a streaming chat completion request
            stream = client.chat.completions.create(
                model=request.model,
                messages=[
                    {"role": "developer", "content": request.developer_message},
                    {"role": "user", "content": request.user_message}
                ],
                stream=True  # Enable streaming response
            )
            
            # Yield each chunk of the response as it becomes available
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        # Return a streaming response to the client
        return StreamingResponse(generate(), media_type="text/plain")
    
    except Exception as e:
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=str(e))

# Define RAG chat endpoint
@app.post("/api/rag-chat")
async def rag_chat(request: RAGChatRequest):
    try:
        # Check if session exists
        if request.session_id not in rag_sessions:
            raise HTTPException(status_code=404, detail="Session not found. Please upload a PDF first.")
        
        vector_db = rag_sessions[request.session_id]
        
        # Search for relevant chunks
        relevant_chunks = vector_db.search_by_text(
            request.user_message, 
            k=3, 
            return_as_text=True
        )
        
        # Create context from relevant chunks
        context = "\n\n".join(relevant_chunks)
        
        # Initialize OpenAI client
        client = OpenAI(api_key=request.api_key)
        
        # Create system message with context
        system_message = f"""You are a helpful assistant that answers questions based on the provided document context. 
        Use the following context to answer the user's question. If the context doesn't contain relevant information, 
        say so politely.

        Context from document:
        {context}

        Answer the user's question based on this context."""
        
        # Create async generator for streaming
        async def generate():
            stream = client.chat.completions.create(
                model=request.model,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": request.user_message}
                ],
                stream=True
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        return StreamingResponse(generate(), media_type="text/plain")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Define PDF upload endpoint for RAG
@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...), api_key: str = None):
    try:
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Create a unique session ID
        session_id = str(uuid.uuid4())
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Process PDF using AIMakerSpace
        pdf_loader = PDFLoader(temp_file_path)
        documents = pdf_loader.load_documents()
        
        # Split documents into chunks
        text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_texts(documents)
        
        # Initialize embedding model if not already done
        global embedding_model
        if embedding_model is None:
            # Set the API key in environment for EmbeddingModel
            if api_key:
                os.environ["OPENAI_API_KEY"] = api_key
            embedding_model = EmbeddingModel()
        
        # Create vector database and index chunks
        vector_db = VectorDatabase(embedding_model)
        await vector_db.abuild_from_list(chunks)
        
        # Store in global sessions
        rag_sessions[session_id] = vector_db
        
        # Clean up temporary file
        os.unlink(temp_file_path)
        
        return {
            "session_id": session_id,
            "message": f"PDF processed successfully. {len(chunks)} chunks indexed.",
            "chunks_count": len(chunks)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
