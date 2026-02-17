'use client';

import { useEffect, useRef } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { Message } from '@/lib/api';
import ChatMessage from './ChatMessage';

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  isStreaming?: boolean;
}

export default function MessageList({ messages, loading, isStreaming = false }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-gray-500">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg">Ask a question about your documents to start a conversation.</p>
        </div>
      </div>
    );
  }

  const lastAssistantIndex = messages.reduce(
    (last, msg, idx) => (msg.role === 'assistant' ? idx : last),
    -1
  );

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.map((message, index) => (
        <ChatMessage
          key={index}
          message={message}
          isStreaming={isStreaming && index === lastAssistantIndex}
        />
      ))}

      {loading && (
        <div className="flex justify-start mb-4">
          <div className="bg-gray-100 rounded-lg px-4 py-3 flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
            <span className="text-sm text-gray-600">Thinking...</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
