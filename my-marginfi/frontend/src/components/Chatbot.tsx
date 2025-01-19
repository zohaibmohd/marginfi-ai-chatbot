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

  useEffect(() => {
    // Load chat history from local storage on mount
    const storedMessages = localStorage.getItem('chatMessages');
    if (storedMessages) {
      setMessages(JSON.parse(storedMessages));
    }
  }, []);

  useEffect(() => {
    // Save chat history to local storage whenever messages change
    localStorage.setItem('chatMessages', JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  // Handle sending a message
  const handleSend = async () => {
    if (input.trim() === '') return; // Prevent sending empty messages

    const userMessage: ChatMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]); // Add user message to the chat
    setInput(''); // Clear input field
    setLoading(true); // Show loading indicator

    try {
      // Use relative path for API call
      const response = await axios.post('/api/chat', { message: input });
      const botMessage: ChatMessage = { sender: 'bot', text: response.data.reply };
      setMessages(prev => [...prev, botMessage]); // Add bot response to the chat
    } catch (error) {
      const errorMessage: ChatMessage = { sender: 'bot', text: 'Sorry, something went wrong. Please try again.' };
      setMessages(prev => [...prev, errorMessage]); // Add error message to the chat
      console.error('Error:', error);
    } finally {
      setLoading(false); // Hide loading indicator
    }
  };

  // Handle pressing Enter key to send message
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
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
          onKeyPress={handleKeyPress}
        />
        <button onClick={handleSend} disabled={loading}>
          <FiSend size={20} /> {/* Optional: Send icon */}
        </button>
      </div>
    </div>
  );
};

export default Chatbot;