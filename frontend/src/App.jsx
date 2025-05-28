import { useState, useRef } from 'react'
import './App.css'
import axios from 'axios'

const MODELS = [
  { label: 'gpt-4.1-mini', value: 'gpt-4.1-mini' },
  { label: 'gpt-4.1-nano', value: 'gpt-4.1-nano' },
]

// Get the API URL based on the environment
const API_URL = import.meta.env.PROD 
  ? '/api/chat'  // In production, use relative path
  : 'http://localhost:8000/api/chat'  // In development, use localhost

function App() {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(MODELS[0].value)
  const [developerMessage, setDeveloperMessage] = useState('')
  const [userMessage, setUserMessage] = useState('')
  const [messages, setMessages] = useState([])
  const messageEndRef = useRef(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Dummy send handler (no backend integration yet)
  const handleSend = async () => {
    if (!userMessage.trim() || !apiKey) return;

    const newMessage = { role: "user", content: userMessage };
    setMessages((prev) => [...prev, newMessage]);
    setUserMessage("");
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(
        API_URL,
        {
          developer_message: "You are a helpful assistant.",
          user_message: userMessage,
          model: model,
          api_key: apiKey,
        },
        {
          responseType: "blob",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const reader = new Response(response.data).body.getReader();
      let assistantMessage = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantMessage += new TextDecoder().decode(value);
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === "assistant") {
            lastMessage.content = assistantMessage;
          } else {
            newMessages.push({ role: "assistant", content: assistantMessage });
          }
          return newMessages;
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
        setError(`Error: ${error.response.status} - ${error.response.data}`);
      } else if (error.request) {
        // The request was made but no response was received
        console.error("Request error:", error.request);
        setError("No response received from the server. Please check your connection.");
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("Error message:", error.message);
        setError(`Error: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

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
          id="userMessage"
          name="userMessage"
          className="chat-input"
          type="text"
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          placeholder="Type your message..."
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
          disabled={isLoading}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={!userMessage.trim() || isLoading}>
          Send
        </button>
      </div>
      {error && <div className="error-message">{error}</div>}
    </div>
  )
}

export default App
