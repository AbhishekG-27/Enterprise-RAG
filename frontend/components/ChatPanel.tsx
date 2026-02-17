'use client';

import { BookOpen, XCircle } from 'lucide-react';
import { Message } from '@/lib/api';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

interface ChatPanelProps {
  selectedFileId: string | null;
  selectedFileName: string | null;
  activeConversationId: string | null;
  messages: Message[];
  onSendMessage: (message: string) => void;
  isQuerying: boolean;
  isStreaming: boolean;
  error: string | null;
}

export default function ChatPanel({
  selectedFileId,
  selectedFileName,
  activeConversationId,
  messages,
  onSendMessage,
  isQuerying,
  isStreaming,
  error
}: ChatPanelProps) {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <span className="text-sm text-gray-700">
            {selectedFileName ? (
              <>
                Chatting about: <span className="font-semibold">{selectedFileName}</span>
              </>
            ) : (
              <>
                Chatting across <span className="font-semibold">all documents</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Message List */}
      <MessageList messages={messages} loading={isQuerying && !isStreaming} isStreaming={isStreaming} />

      {/* Error Banner */}
      {error && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-3 flex items-start space-x-2">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput onSendMessage={onSendMessage} disabled={isQuerying || isStreaming} />
    </div>
  );
}
