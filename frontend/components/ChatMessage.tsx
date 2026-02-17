'use client';

import { useState } from 'react';
import { User, Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { Message } from '@/lib/api';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export default function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const isHuman = message.role === 'human';

  if (isHuman) {
    return (
      <div className="flex justify-end mb-4">
        <div className="flex items-start space-x-2 max-w-[80%]">
          <div className="bg-blue-600 text-white rounded-lg px-4 py-2">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <div className="p-2 bg-blue-100 rounded-full flex-shrink-0">
            <User className="w-4 h-4 text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="flex items-start space-x-2 max-w-[80%]">
        <div className="p-2 bg-gray-200 rounded-full flex-shrink-0">
          <Bot className="w-4 h-4 text-gray-600" />
        </div>
        <div className="flex-1">
          <div className="bg-gray-100 rounded-lg px-4 py-2">
            <p className="whitespace-pre-wrap break-words text-gray-800">
              {message.content}
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 ml-0.5 bg-gray-600 animate-pulse align-middle" />
              )}
            </p>
          </div>

          {message.sources && message.sources.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setSourcesExpanded(!sourcesExpanded)}
                className="flex items-center space-x-1 text-sm text-gray-600 hover:text-blue-600 transition-colors"
              >
                {sourcesExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                <span>
                  {sourcesExpanded ? 'Hide' : 'View'} {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
                </span>
              </button>

              {sourcesExpanded && (
                <div className="mt-2 space-y-2">
                  {message.sources.map((source, index) => (
                    <div
                      key={index}
                      className="p-3 bg-white rounded-lg border border-gray-200 text-sm"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-medium text-gray-700">
                          Source {index + 1}
                          {source.metadata.page && ` - Page ${source.metadata.page}`}
                        </span>
                        <span className="text-xs text-gray-500">
                          {(source.score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-gray-600 leading-relaxed">
                        {source.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
