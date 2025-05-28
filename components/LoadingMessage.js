import { Loader2 } from "lucide-react";

export default function LoadingMessage({ content, role }) {
  return (
    <div className="flex flex-col space-y-2">
      {/* Display partial content if available */}
      {content && <div>{content}</div>}
      
      {/* Loading animation - simpler dots like ChatGPT */}
      <div className="flex items-center gap-1 mt-1">
        <div className="animate-pulse h-2 w-2 bg-gray-400 dark:bg-gray-600 rounded-full"></div>
        <div className="animate-pulse h-2 w-2 bg-gray-400 dark:bg-gray-600 rounded-full animation-delay-200" style={{ animationDelay: '0.2s' }}></div>
        <div className="animate-pulse h-2 w-2 bg-gray-400 dark:bg-gray-600 rounded-full animation-delay-400" style={{ animationDelay: '0.4s' }}></div>
      </div>
    </div>
  );
} 