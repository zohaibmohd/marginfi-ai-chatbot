// frontend/src/App.tsx

import React from 'react';
import Chatbot from './components/Chatbot';
import './App.css';

const App: React.FC = () => {
  return (
    <div className="App">
      <Chatbot />
    </div>
  );
};

export default App;