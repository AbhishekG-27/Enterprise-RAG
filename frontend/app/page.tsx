'use client';

import { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import FileList from '@/components/FileList';
import ConversationList from '@/components/ConversationList';
import ChatPanel from '@/components/ChatPanel';
import {
  Conversation,
  Message,
  listConversations,
  getConversation,
  deleteConversation,
  queryFile,
} from '@/lib/api';

export default function Home() {
  // Existing state
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // New conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Fetch all conversations
  const fetchConversations = async () => {
    setConversationsLoading(true);
    try {
      const response = await listConversations();
      setConversations(response.conversations);
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setConversationsLoading(false);
    }
  };

  // Load a specific conversation's messages
  const handleSelectConversation = async (conversationId: string) => {
    setActiveConversationId(conversationId);
    setChatError(null);
    try {
      const response = await getConversation(conversationId);
      setMessages(response.messages);

      // Set file context from the conversation metadata
      const conv = conversations.find(c => c.id === conversationId);
      if (conv?.file_uuid) {
        setSelectedFileId(conv.file_uuid);
      }
    } catch (err: any) {
      setChatError('Failed to load conversation');
      setMessages([]);
    }
  };

  // Start a new conversation
  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setChatError(null);
  };

  // Delete a conversation
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await deleteConversation(conversationId);

      // If the deleted conversation was active, clear the chat
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }

      // Refresh the conversation list
      fetchConversations();
    } catch (err: any) {
      setChatError('Failed to delete conversation');
    }
  };

  // Send a message
  const handleSendMessage = async (messageText: string) => {
    setChatError(null);
    setIsQuerying(true);

    // Optimistically add the human message to the UI immediately
    const humanMessage: Message = {
      role: 'human',
      content: messageText,
    };
    setMessages(prev => [...prev, humanMessage]);

    try {
      const response = await queryFile(
        messageText,
        3,
        selectedFileId || undefined,
        activeConversationId || undefined
      );

      // If this was a new conversation, the backend auto-created one
      if (!activeConversationId) {
        setActiveConversationId(response.conversation_id);
        // Refresh conversation list to show the new conversation
        fetchConversations();
      }

      // Add the assistant message to the UI
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err: any) {
      setChatError(err.response?.data?.detail || 'Failed to process query');
    } finally {
      setIsQuerying(false);
    }
  };

  // Handle file selection
  const handleSelectFile = (fileId: string | null, fileName: string | null) => {
    setSelectedFileId(fileId);
    setSelectedFileName(fileName);

    // When changing files, start a fresh conversation
    setActiveConversationId(null);
    setMessages([]);
    setChatError(null);
  };

  // Upload success handler
  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                RAG Document Assistant
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
          <div className="flex-shrink-0 p-4 space-y-4 border-b border-gray-200 overflow-y-auto max-h-[50%]">
            <FileUpload onUploadSuccess={handleUploadSuccess} />
            <FileList
              selectedFileId={selectedFileId}
              onSelectFile={handleSelectFile}
              refreshTrigger={refreshTrigger}
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversationId}
              loading={conversationsLoading}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewConversation}
              onDeleteConversation={handleDeleteConversation}
            />
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <ChatPanel
            selectedFileId={selectedFileId}
            selectedFileName={selectedFileName}
            activeConversationId={activeConversationId}
            messages={messages}
            onSendMessage={handleSendMessage}
            isQuerying={isQuerying}
            error={chatError}
          />
        </main>
      </div>
    </div>
  );
}
