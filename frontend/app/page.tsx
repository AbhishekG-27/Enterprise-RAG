'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import FileList from '@/components/FileList';
import QueryInterface from '@/components/QueryInterface';
import { BookOpen } from 'lucide-react';

export default function Home() {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    // Trigger file list refresh
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSelectFile = (fileId: string | null, fileName: string | null) => {
    setSelectedFileId(fileId);
    setSelectedFileName(fileName)
    // You could fetch the filename from the file list if needed
    // For now, we'll handle it in the QueryInterface component
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                RAG Document Assistant
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Upload PDFs and ask questions using AI-powered retrieval
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Upload & File List */}
          <div className="lg:col-span-1 space-y-6">
            <FileUpload onUploadSuccess={handleUploadSuccess} />
            <FileList
              selectedFileId={selectedFileId}
              onSelectFile={handleSelectFile}
              refreshTrigger={refreshTrigger}
            />
          </div>

          {/* Right Column - Query Interface */}
          <div className="lg:col-span-2">
            <QueryInterface
              selectedFileId={selectedFileId}
              selectedFileName={selectedFileName}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-600">
            Powered by Qdrant, FastAPI, and LLama 3.2
          </p>
        </div>
      </footer>
    </div>
  );
}
