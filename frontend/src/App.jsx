import { useState, useRef } from 'react'
import './App.css'
import axios from 'axios'

const MODELS = [
  { label: 'gpt-4.1-mini', value: 'gpt-4.1-mini' },
  { label: 'gpt-4.1-nano', value: 'gpt-4.1-nano' },
]

const API_URL = import.meta.env.PROD 
  ? '/api/chat'
  : 'http://localhost:8000/api/chat'
const RAG_UPLOAD_URL = import.meta.env.PROD
  ? '/api/upload-pdf'
  : 'http://localhost:8000/api/upload-pdf'
const RAG_CHAT_URL = import.meta.env.PROD
  ? '/api/rag-chat'
  : 'http://localhost:8000/api/rag-chat'

function App() {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(MODELS[0].value)
  const [developerMessage, setDeveloperMessage] = useState('')
  const [userMessage, setUserMessage] = useState('')
  const [messages, setMessages] = useState([])
  const messageEndRef = useRef(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // RAG state
  const [pdfFile, setPdfFile] = useState(null)
  const [ragSessionId, setRagSessionId] = useState('')
  const [uploadStatus, setUploadStatus] = useState('idle') // idle | uploading | success | error
  const [uploadMessage, setUploadMessage] = useState('')

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // PDF upload handler
  const handlePdfChange = (e) => {
    setPdfFile(e.target.files[0])
    setUploadStatus('idle')
    setUploadMessage('')
    setRagSessionId('')
    setMessages([])
  }

  const handlePdfUpload = async () => {
    if (!pdfFile) return
    setUploadStatus('uploading')
    setUploadMessage('')
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', pdfFile)
      formData.append('api_key', apiKey)
      const response = await axios.post(RAG_UPLOAD_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setRagSessionId(response.data.session_id)
      setUploadStatus('success')
      setUploadMessage(response.data.message)
    } catch (err) {
      setUploadStatus('error')
      setUploadMessage('')
      setError(err.response?.data?.detail || 'Failed to upload PDF')
    }
  }

  // RAG chat handler
  const handleRagSend = async () => {
    if (!userMessage.trim() || !apiKey || !ragSessionId) return
    const newMessage = { role: 'user', content: userMessage }
    setMessages((prev) => [...prev, newMessage])
    setUserMessage('')
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.post(
        RAG_CHAT_URL,
        {
          session_id: ragSessionId,
          user_message: newMessage.content,
          model: model,
          api_key: apiKey,
        },
        {
          responseType: 'blob',
          headers: { 'Content-Type': 'application/json' },
        }
      )
      const reader = new Response(response.data).body.getReader()
      let assistantMessage = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantMessage += new TextDecoder().decode(value)
        setMessages((prev) => {
          const newMessages = [...prev]
          const lastMessage = newMessages[newMessages.length - 1]
          if (lastMessage.role === 'assistant') {
            lastMessage.content = assistantMessage
          } else {
            newMessages.push({ role: 'assistant', content: assistantMessage })
          }
          return newMessages
        })
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to chat with PDF')
    } finally {
      setIsLoading(false)
    }
  }

  // Existing non-RAG chat handler (for when no PDF is uploaded)
  const handleSend = async () => {
    if (!userMessage.trim() || !apiKey) return
    const newMessage = { role: 'user', content: userMessage }
    setMessages((prev) => [...prev, newMessage])
    setUserMessage('')
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.post(
        API_URL,
        {
          developer_message: 'You are a helpful assistant.',
          user_message: userMessage,
          model: model,
          api_key: apiKey,
        },
        {
          responseType: 'blob',
          headers: { 'Content-Type': 'application/json' },
        }
      )
      const reader = new Response(response.data).body.getReader()
      let assistantMessage = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantMessage += new TextDecoder().decode(value)
        setMessages((prev) => {
          const newMessages = [...prev]
          const lastMessage = newMessages[newMessages.length - 1]
          if (lastMessage.role === 'assistant') {
            lastMessage.content = assistantMessage
          } else {
            newMessages.push({ role: 'assistant', content: assistantMessage })
          }
          return newMessages
        })
      }
    } catch (error) {
      setError(error.response?.data || error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>OpenAI Chat Interface</h1>
      </header>
      <div className="chat-controls">
        <label>
          API Key:
          <input
            id="apiKey"
            name="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your OpenAI API key"
            autoComplete="off"
          />
        </label>
        <label>
          Model:
          <select
            id="model"
            name="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* PDF Upload Section */}
      <div className="pdf-upload-section">
        <h2>Upload a PDF to Chat (RAG Mode)</h2>
        <input
          type="file"
          accept="application/pdf"
          onChange={handlePdfChange}
          disabled={uploadStatus === 'uploading'}
        />
        <button onClick={handlePdfUpload} disabled={!pdfFile || uploadStatus === 'uploading'}>
          {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload PDF'}
        </button>
        {uploadStatus === 'success' && <div className="success-message">{uploadMessage}</div>}
        {uploadStatus === 'error' && <div className="error-message">{error}</div>}
        {ragSessionId && <div className="info-message">RAG Mode enabled for this session.</div>}
      </div>
      {/* Chat History */}
      <div className="chat-history">
        {messages.length === 0 && <div className="chat-placeholder">No messages yet.</div>}
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message chat-message-${msg.role}`}>
            <strong>{msg.role === 'user' ? 'You' : 'Assistant'}:</strong> {msg.content}
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>
      {/* Chat Input Row */}
      <div className="chat-input-row">
        <input
          id="userMessage"
          name="userMessage"
          className="chat-input"
          type="text"
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          placeholder={ragSessionId ? 'Ask a question about your PDF...' : 'Type your message...'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') ragSessionId ? handleRagSend() : handleSend()
          }}
          disabled={isLoading}
        />
        <button
          className="chat-send-btn"
          onClick={ragSessionId ? handleRagSend : handleSend}
          disabled={!userMessage.trim() || isLoading}
        >
          Send
        </button>
      </div>
      {error && <div className="error-message">{error}</div>}
    </div>
  )
}

export default App
