// frontend/src/components/Message.tsx

import React from 'react';
import './Message.css';

interface Props {
  sender: 'user' | 'bot';
  text: string;
}

const Message: React.FC<Props> = ({ sender, text }) => {
  return (
    <div className={`message ${sender}`}>
      <div className="message-text">{text}</div>
    </div>
  );
};

export default Message;