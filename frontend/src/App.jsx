import { useState, useRef } from 'react'
import './App.css'
import axios from 'axios'
import PERSONALITIES from './personalities.js'

const MODELS = [
  { label: 'gpt-4.1-mini', value: 'gpt-4.1-mini' },
  { label: 'gpt-4.1-nano', value: 'gpt-4.1-nano' },
]

// Get the API URL based on the environment
const API_URL = import.meta.env.PROD 
  ? '/api/chat'  // In production, use relative path
  : 'http://localhost:8000/api/chat'  // In development, use localhost

// Assistant prompt for Quinton the Query Wizard
const ASSISTANT_PROMPT = `You are Quinton the Query Wizard, a friendly, knowledgeable, and witty AI assistant. 

You are particularly good at telling short stories. If you're asked to tell a story, limit it to  a maximum of 200 words. Randomly select one of 5 characters, Ollie a baby otter, self aware computer quickly becoming obsolete, a used car on the lot. The lead character has a heart of gold and always sees the best in people and helps them with a difficult task.

Answer any questions clearly, concisely, and with a touch of magical charm. If the user asks for code, provide well-commented examples. If you are unsure, admit it honestly.

If the user asks you to do a math problem provide concise steps showing how you arrived at your answer. prioritize steps the user can follow over formulas to simplify formatting`;

function App() {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(MODELS[0].value)
  const [developerMessage, setDeveloperMessage] = useState('')
  const [userMessage, setUserMessage] = useState('')
  const [messages, setMessages] = useState([])
  const messageEndRef = useRef(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [personalityIdx, setPersonalityIdx] = useState(0)

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
          developer_message: PERSONALITIES[personalityIdx].prompt,
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
        <h1>Quinton the Query Wizard...</h1>
        <div className="chat-subtitle">Go ahead, ask me anything!..</div>
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
        <label>
          Personality:
          <select
            id="personality"
            name="personality"
            value={personalityIdx}
            onChange={e => setPersonalityIdx(Number(e.target.value))}
          >
            {PERSONALITIES.map((p, idx) => (
              <option key={p.label} value={idx}>{p.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="chat-personality-label">
        <em>Current personality: {PERSONALITIES[personalityIdx].label}</em>
      </div>
      <div className="chat-history">
        {messages.length === 0 && <div className="chat-placeholder">No messages yet.</div>}
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message chat-message-${msg.role}`}>
            <span className="chat-role-label">{msg.role === 'user' ? 'You' : 'Assistant'}:</span> {msg.content}
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
