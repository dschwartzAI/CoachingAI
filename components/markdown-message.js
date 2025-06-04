"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Add a component for rendering markdown messages
export default function MarkdownMessage({ content }) {
  return (
    <ReactMarkdown
      //className="prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:mb-2 prose-headings:mt-4 prose-pre:my-1 max-w-none" 
      remarkPlugins={[remarkGfm]}
      components={{
        // Allow <a> tags to be rendered properly
        a: ({ node, ...props }) => (
          <a 
            {...props} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-600 hover:underline"
          />
        )
      }}
    >
      {content}
    </ReactMarkdown>
  );
} 