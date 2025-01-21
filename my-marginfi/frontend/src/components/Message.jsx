// my-marginfi/frontend/src/components/Message.jsx

import React from 'react'
import './Chatbot.css' // or keep it separate if you prefer

export default function Message({ sender, text }) {
  return (
    <div className={`message ${sender}`}>
      <p>{text}</p>
    </div>
  )
}