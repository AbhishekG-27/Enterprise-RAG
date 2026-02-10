'use client';

import { MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { Conversation } from '@/lib/api';

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  loading: boolean;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
}

export default function ConversationList({
  conversations,
  activeConversationId,
  loading,
  onSelectConversation,
  onDeleteConversation
}: ConversationListProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>No conversations yet.</p>
            <p className="mt-1">Upload a PDF to start chatting.</p>
          </div>
        )}

        {!loading && conversations.length > 0 && (
          <div className="p-2 space-y-1">
            {conversations.map((conversation) => {
              const isActive = activeConversationId === conversation.id;
              return (
                <div
                  key={conversation.id}
                  className={`group relative rounded-lg transition-all ${
                    isActive
                      ? 'bg-blue-50 border-l-4 border-blue-600'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <button
                    onClick={() => onSelectConversation(conversation.id)}
                    className="w-full text-left p-3 pr-10"
                  >
                    <p className={`text-sm font-medium truncate ${
                      isActive ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {conversation.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(conversation.updated_at)}
                    </p>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conversation.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
