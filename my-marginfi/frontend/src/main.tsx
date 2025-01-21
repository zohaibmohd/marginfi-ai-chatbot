// frontend/src/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App'; // App is the default export from App.jsx

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);