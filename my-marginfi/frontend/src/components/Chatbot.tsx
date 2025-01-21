// frontend/src/components/Chatbot.tsx

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Message from './Message';
import './Chatbot.css';
import { FiSend } from 'react-icons/fi'; // Optional: Using an icon for the send button

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to the bottom whenever messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load chat history from local storage on mount
  useEffect(() => {
    const storedMessages = localStorage.getItem('chatMessages');
    if (storedMessages) {
      setMessages(JSON.parse(storedMessages));
    }
  }, []);

  // Save chat history to local storage whenever messages change + scroll down
  useEffect(() => {
    localStorage.setItem('chatMessages', JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  // Convert local ChatMessage objects to the format the backend expects
  const formatConversationForBackend = (allMessages: ChatMessage[]) => {
    return allMessages.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));
  };

  // Handle sending a message
  const handleSend = async () => {
    if (input.trim() === '') return; // Prevent sending empty messages

    // 1) Add the new user message to the conversation
    const userMessage: ChatMessage = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');   // Clear input field
    setLoading(true);

    try {
      // 2) Prepare the full conversation for the backend
      const conversation = formatConversationForBackend([...messages, userMessage]);

      // 3) Send to backend (make sure your /api/chat route expects { messages: [...] })
      const response = await axios.post('/api/chat', { messages: conversation });

      // 4) Add the bot’s reply to the conversation
      const botMessage: ChatMessage = {
        sender: 'bot',
        text: response.data.reply || 'No response',
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: ChatMessage = {
        sender: 'bot',
        text: 'Sorry, something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Send message on Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h2>MarginFi AI Assistant</h2>
      </div>

      <div className="chatbot-messages">
        {messages.map((msg, index) => (
          <Message key={index} sender={msg.sender} text={msg.text} />
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
          <FiSend size={20} />
        </button>
      </div>
    </div>
  );
};

export default Chatbot;