'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2, RefreshCw } from 'lucide-react';
import { listFiles, FileInfo } from '@/lib/api';

interface FileListProps {
  selectedFileId: string | null;
  onSelectFile: (fileId: string | null, fileName: string | null) => void;
  refreshTrigger: number;
}

export default function FileList({ selectedFileId, onSelectFile, refreshTrigger }: FileListProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listFiles();
      setFiles(response.files);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [refreshTrigger]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Your Documents</h2>
        <button
          onClick={fetchFiles}
          disabled={loading}
          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Refresh list"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-800 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && files.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>No documents uploaded yet</p>
        </div>
      )}

      {!loading && !error && files.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => onSelectFile(null, null)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              selectedFileId === null
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">All Documents</p>
                <p className="text-sm text-gray-500">Search across all uploaded files</p>
              </div>
            </div>
          </button>

          {files.map((file) => (
            <button
              key={file.file_id}
              onClick={() => onSelectFile(file.file_id, file.filename)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                selectedFileId === file.file_id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start space-x-3">
                <FileText className="w-5 h-5 text-gray-600 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{file.filename}</p>
                  <p className="text-sm text-gray-500">{file.chunks} chunks</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && !error && files.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Total: <span className="font-semibold">{files.length}</span> document
            {files.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
