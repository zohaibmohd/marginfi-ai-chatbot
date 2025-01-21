// frontend/src/components/Message.tsx
import React from 'react';

interface MessageProps {
  sender: 'user' | 'bot';
  text: string;
}

const Message: React.FC<MessageProps> = ({ sender, text }) => {
  return (
    <div className={`message ${sender}`}>
      {text}
    </div>
  );
};

export default Message;