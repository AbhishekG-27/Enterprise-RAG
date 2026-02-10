import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface FileInfo {
  file_id: string;
  filename: string;
  chunks: number;
}

export interface QuerySource {
  content: string;
  metadata: {
    page?: number;
    source?: string;
  };
  score: number;
}

export interface QueryResponse {
  query: string;
  answer: string;
  sources: QuerySource[];
  num_sources: number;
  conversation_id: string;
}

export interface Message {
  role: 'human' | 'assistant';
  content: string;
  sources?: QuerySource[] | null;
  created_at?: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  file_uuid: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail {
  conversation_id: string;
  messages: Message[];
}

export interface CreateConversationResponse {
  conversation_id: string;
}

export interface ListConversationsResponse {
  conversations: Conversation[];
}

export interface DeleteConversationResponse {
  message: string;
}

export interface UploadResponse {
  message: string;
  uuid: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  chunks_created: number;
}

// Upload PDF file
export const uploadPDF = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post(`${API_BASE_URL}/upload_pdf`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

// List all files
export const listFiles = async (): Promise<{ total_files: number; files: FileInfo[] }> => {
  const response = await api.get('/list_files');
  return response.data;
};

// Query a file
export const queryFile = async (
  query: string,
  k: number = 3,
  fileUuid?: string,
  conversationId?: string
): Promise<QueryResponse> => {
  const response = await api.post('/query_file', {
    query,
    k,
    file_uuid: fileUuid || null,
    conversation_id: conversationId || null,
  });

  return response.data;
};

// Create a new conversation
export const createConversation = async (
  fileUuid?: string
): Promise<CreateConversationResponse> => {
  const response = await api.post('/conversations', {
    file_uuid: fileUuid || null,
  });
  return response.data;
};

// List all conversations, optionally filtered by file
export const listConversations = async (
  fileUuid?: string
): Promise<ListConversationsResponse> => {
  const params = fileUuid ? { file_uuid: fileUuid } : {};
  const response = await api.get('/conversations', { params });
  return response.data;
};

// Get a specific conversation with all messages
export const getConversation = async (
  conversationId: string
): Promise<ConversationDetail> => {
  const response = await api.get(`/conversations/${conversationId}`);
  return response.data;
};

// Delete a conversation
export const deleteConversation = async (
  conversationId: string
): Promise<DeleteConversationResponse> => {
  const response = await api.delete(`/conversations/${conversationId}`);
  return response.data;
};

export default api;
