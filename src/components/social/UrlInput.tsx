// components/social/UrlInput.tsx
import React from 'react';

interface UrlInputProps {
  url: string;
  setUrl: (url: string) => void;
  useCustomUrl: boolean;
  setUseCustomUrl: (useCustomUrl: boolean) => void;
  availablePosts: { post_id: string; post_url: string; post_date: string; title: string }[];
  setFetchedUrlContent: (content: string | null) => void;
}

const UrlInput: React.FC<UrlInputProps> = ({
  url,
  setUrl,
  useCustomUrl,
  setUseCustomUrl,
  availablePosts,
  setFetchedUrlContent,
}) => {
  return (
    <div>
      <label htmlFor="substack-url" className="block text-sm font-medium text-gray-300 mb-2">Step 1: Select Post</label>
      <div className="flex items-start gap-4">
        <div className="flex-grow">
          {useCustomUrl ? (
            <input
              type="url" id="substack-url" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourname.substack.com/p/your-post-title"
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200 placeholder-gray-500"
            />
          ) : (
            <select
              id="substack-url" value={url} onChange={(e) => setUrl(e.target.value)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-200"
              disabled={availablePosts.length === 0}
            >
              {availablePosts.length > 0 ? (
                availablePosts.map(post => (
                  <option key={post.post_id} value={post.post_url}>{new Date(post.post_date).toLocaleDateString()} - {post.title}</option>
                ))
              ) : (<option>No articles found in corpus</option>)}
            </select>
          )}
        </div>
        <div className="w-44 flex-shrink-0 flex flex-col items-start gap-2 pt-1">
          <div className="flex items-center">
            <input
              type="checkbox" id="custom-url-toggle" checked={useCustomUrl}
              onChange={(e) => {
                setUseCustomUrl(e.target.checked);
                if (!e.target.checked) setFetchedUrlContent(null);
              }}
              className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="custom-url-toggle" className="ml-2 text-sm text-gray-300 whitespace-nowrap">Use Custom URL</label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UrlInput;
