'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import MarkdownMessage from '@/components/markdown-message';

export default function StreamingMessage({ 
  content = '', 
  isComplete = false, 
  className 
}) {
  const [showCursor, setShowCursor] = useState(false);
  const isCompleteRef = useRef(isComplete);
  const contentRef = useRef(content);

  // Update refs when props change
  useEffect(() => {
    isCompleteRef.current = isComplete;
    contentRef.current = content;
  }, [isComplete, content]);

  // Handle cursor blinking - only show cursor when streaming and has content
  useEffect(() => {
    if (isComplete) {
      setShowCursor(false);
      return;
    }

    // Only show blinking cursor if we have content
    if (content && content.trim()) {
      setShowCursor(true);
      const interval = setInterval(() => {
        setShowCursor(prev => !prev);
      }, 500);
      return () => clearInterval(interval);
    } else {
      // No content yet, don't show cursor
      setShowCursor(false);
    }
  }, [isComplete, content]);

  // Show loading dots when streaming but no content yet
  const showLoadingDots = !isComplete && (!content || content.trim() === '');

  return (
    <div className="flex w-full max-w-4xl justify-start">
      <div className={cn(
        "flex items-start space-x-3 max-w-[85%] sm:max-w-[80%] flex-row",
        className
      )}>
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-muted text-muted-foreground">
          <Bot className="h-4 w-4" />
        </div>
        
        <div className="rounded-2xl px-4 py-3 shadow-sm bg-muted/60 text-foreground">
          <div className="relative">
            {showLoadingDots ? (
              // Show loading dots when no content yet
              <div className="flex items-center gap-1">
                <div className="animate-pulse h-2 w-2 bg-gray-400 dark:bg-gray-600 rounded-full"></div>
                <div className="animate-pulse h-2 w-2 bg-gray-400 dark:bg-gray-600 rounded-full" style={{ animationDelay: '0.2s' }}></div>
                <div className="animate-pulse h-2 w-2 bg-gray-400 dark:bg-gray-600 rounded-full" style={{ animationDelay: '0.4s' }}></div>
              </div>
            ) : (
              // Show content with optional cursor
              <div className="flex items-end">
                <div className="flex-1">
                  <MarkdownMessage content={content} />
                </div>
                {!isComplete && showCursor && content && (
                  <span className="inline-block w-0.5 h-4 bg-primary ml-1 animate-pulse flex-shrink-0" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 