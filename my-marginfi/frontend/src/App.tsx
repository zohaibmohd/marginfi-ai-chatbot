// frontend/src/App.tsx
import React from 'react';
import Chatbot from './components/Chatbot';

function App() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--solana-bg)', // Ensure var(--solana-bg) is defined in index.css
      }}
    >
      <Chatbot />
    </div>
  );
}

export default App;