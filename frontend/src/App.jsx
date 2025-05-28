import { useState, useRef } from 'react'
import './App.css'

const MODELS = [
  { label: 'gpt-4.1-mini', value: 'gpt-4.1-mini' },
  { label: 'gpt-4.1-nano', value: 'gpt-4.1-nano' },
]

function App() {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(MODELS[0].value)
  const [developerMessage, setDeveloperMessage] = useState('')
  const [userMessage, setUserMessage] = useState('')
  const [messages, setMessages] = useState([])
  const messageEndRef = useRef(null)

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Dummy send handler (no backend integration yet)
  const handleSend = () => {
    if (!userMessage.trim()) return
    setMessages((msgs) => [
      ...msgs,
      { role: 'user', content: userMessage },
    ])
    setUserMessage('')
    setTimeout(scrollToBottom, 100)
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
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your OpenAI API key"
            autoComplete="off"
          />
        </label>
        <label>
          Model:
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="chat-history">
        {messages.length === 0 && <div className="chat-placeholder">No messages yet.</div>}
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message chat-message-${msg.role}`}>
            <strong>{msg.role === 'user' ? 'You' : 'Assistant'}:</strong> {msg.content}
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          type="text"
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          placeholder="Type your message..."
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={!userMessage.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}

export default App
