// my-marginfi/frontend/src/components/Chatbot.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import Message from './Message.jsx'
import './Chatbot.css' // Updated styling with Solana theme

export default function Chatbot() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message to server
  const handleSend = useCallback(async () => {
    if (!input.trim()) return

    const userMessage = { sender: 'user', text: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      // NOTE: If you have a custom URL in .env, you might use:
      // const url = import.meta.env.VITE_BACKEND_URL || '/api/chat'
      // For example:
      const url = import.meta.env.VITE_BACKEND_URL || '/api/chat'

      const response = await axios.post(url, { message: input })
      const botMessage = { sender: 'bot', text: response.data.reply }
      setMessages((prev) => [...prev, botMessage])
    } catch (error) {
      console.error('Error:', error)
      const errorMessage = {
        sender: 'bot',
        text: 'Sorry, something went wrong. Please try again.',
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }, [input])

  // Handle enter key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h2>MarginFi AI Assistant</h2>
      </div>

      <div className="chatbot-messages">
        {messages.map((msg, i) => (
          <Message key={i} sender={msg.sender} text={msg.text} />
        ))}
        {loading && <Message sender="bot" text="Thinking..." />}
        <div ref={messagesEndRef} />
      </div>

      <div className="chatbot-input">
        <input
          type="text"
          placeholder="Ask me anything about MarginFi..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={handleSend} disabled={loading}>
          Send
        </button>
      </div>
    </div>
  )
}