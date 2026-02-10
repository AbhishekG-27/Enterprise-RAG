'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Upload, FolderOpen } from 'lucide-react';
import UploadModal from '@/components/UploadModal';
import DocumentSelectModal from '@/components/DocumentSelectModal';
import ConversationList from '@/components/ConversationList';
import ChatPanel from '@/components/ChatPanel';
import {
  Conversation,
  Message,
  listConversations,
  getConversation,
  deleteConversation,
  queryFile,
  createConversation,
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

  // Modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);

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
  const handleUploadSuccess = async (fileUuid: string, originalFilename: string) => {
    // Refresh the file list
    setRefreshTrigger(prev => prev + 1);

    // Select the newly uploaded file
    setSelectedFileId(fileUuid);
    setSelectedFileName(originalFilename);

    try {
      // Create a new conversation tied to this file
      const response = await createConversation(fileUuid);

      // Set the new conversation as active and clear messages
      setActiveConversationId(response.conversation_id);
      setMessages([]);
      setChatError(null);

      // Refresh conversation list
      fetchConversations();
    } catch (err: any) {
      console.error('Failed to create conversation:', err);
      setChatError('Failed to create conversation. You can still chat, and a conversation will be created automatically.');
      // Fall back gracefully - the backend will auto-create a conversation on first queryFile call
    }
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
          {/* Button Area */}
          <div className="flex-shrink-0 p-4 space-y-3 border-b border-gray-200">
            <button
              onClick={() => setUploadModalOpen(true)}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Upload className="w-5 h-5" />
              <span>Upload PDF</span>
            </button>

            <button
              onClick={() => setDocModalOpen(true)}
              className="w-full border-2 border-gray-300 text-gray-700 px-4 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
            >
              <FolderOpen className="w-5 h-5" />
              <span>Documents</span>
            </button>

            {/* Selected File Indicator */}
            {selectedFileName && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Querying:</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <p className="text-sm font-medium text-blue-900 truncate">
                    {selectedFileName}
                  </p>
                </div>
              </div>
            )}
            {!selectedFileName && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Querying:</p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <p className="text-sm font-medium text-gray-700">
                    All Documents
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-hidden">
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversationId}
              loading={conversationsLoading}
              onSelectConversation={handleSelectConversation}
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

      {/* Modals */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      <DocumentSelectModal
        isOpen={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        selectedFileId={selectedFileId}
        onSelectFile={handleSelectFile}
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
}
