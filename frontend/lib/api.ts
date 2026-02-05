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
  fileUuid?: string
): Promise<QueryResponse> => {
  const response = await api.post('/query_file', {
    query,
    k,
    file_uuid: fileUuid || null,
  });

  return response.data;
};

export default api;
