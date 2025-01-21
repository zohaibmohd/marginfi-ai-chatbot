// frontend/src/App.jsx
import React from 'react';
import Chatbot from './components/Chatbot';

export default function App() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--solana-bg)', // Ensure var(--solana-bg) is defined in your index.css
      }}
    >
      <Chatbot />
    </div>
  );
}