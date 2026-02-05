'use client';

import { useState } from 'react';
import { Send, Loader2, BookOpen } from 'lucide-react';
import { queryFile, QueryResponse } from '@/lib/api';

interface QueryInterfaceProps {
  selectedFileId: string | null;
  selectedFileName: string | null;
}

export default function QueryInterface({ selectedFileId, selectedFileName }: QueryInterfaceProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await queryFile(query, 3, selectedFileId || undefined);
      setResponse(result);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to process query');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Ask Questions</h2>

      {selectedFileName && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <span className="text-sm text-blue-900">
            Searching in: <span className="font-semibold">{selectedFileName}</span>
          </span>
        </div>
      )}

      {!selectedFileName && (
        <div className="mb-4 p-3 bg-purple-50 rounded-lg flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-purple-600" />
          <span className="text-sm text-purple-900">
            Searching across <span className="font-semibold">all documents</span>
          </span>
        </div>
      )}

      <form onSubmit={handleQuery} className="space-y-4">
        <div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about your documents..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Ask Question</span>
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-6 p-4 bg-red-50 text-red-800 rounded-lg">
          <p className="text-sm font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {response && (
        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Answer</h3>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-gray-800 whitespace-pre-wrap">{response.answer}</p>
            </div>
          </div>

          {response.sources.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Sources ({response.num_sources})
              </h3>
              <div className="space-y-3">
                {response.sources.map((source, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Source {index + 1}
                        {source.metadata.page && ` - Page ${source.metadata.page}`}
                      </span>
                      <span className="text-xs text-gray-500">
                        Score: {(source.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {source.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
