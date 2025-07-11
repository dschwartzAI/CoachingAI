import { MessageCircle, User, Clock, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Add a component for rendering markdown messages
function MarkdownMessage({ content }) {
  // Gracefully handle non-string or empty content
  const safeContent = typeof content === 'string' ? content : '';

  // Check if content is short and simple (no markdown formatting)
  const isShortSimple = safeContent.length <= 100 && 
    !safeContent.includes('\n') && 
    !safeContent.includes('**') && 
    !safeContent.includes('*') && 
    !safeContent.includes('`') && 
    !safeContent.includes('#') && 
    !safeContent.includes('[') && 
    !safeContent.includes('](') &&
    !safeContent.includes('- ') &&
    !safeContent.includes('1. ') &&
    !safeContent.includes('2. ') &&
    !safeContent.includes('3. ') &&
    !/^\d+\.\s/.test(safeContent);

  // For short, simple messages, render as plain text to avoid paragraph margins
  if (isShortSimple) {
    return <span className="text-base leading-relaxed">{safeContent}</span>;
  }

  // For longer or formatted content, use markdown with proper prose styling
  return (
    <div className="prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:mb-2 prose-headings:mt-4 prose-pre:my-1 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 max-w-none text-[inherit] [&_*]:text-[inherit]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{safeContent}</ReactMarkdown>
    </div>
  );
}

export default function Message({ message }) {
  const isUser = message.role === 'user';
  const timestamp = message.timestamp || new Date();
  const formattedTime = format(new Date(timestamp), 'HH:mm');

  return (
    <div className={cn(
      "flex items-start gap-3 max-w-[85%] group relative py-2", 
      isUser ? "self-end ml-auto" : "self-start mr-auto"
    )}>
      {!isUser && (
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src="/james-face.png" alt="DarkJK" />
          <AvatarFallback className="bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn(
        "rounded-2xl p-3 text-sm", 
        isUser 
          ? "bg-primary text-primary-foreground rounded-tr-none w-fit" 
          : "bg-muted text-foreground rounded-tl-none overflow-auto"
      )}>
        {/* Render content with markdown for assistant messages or as text for users */}
        <div className={isUser ? "break-words" : ""}>
          {message.isJSX ? (
            message.content
          ) : !isUser ? (
            <MarkdownMessage content={message.content} />
          ) : (
            message.content
          )}
        </div>
        
        <div className={cn(
          "text-[10px] opacity-70 mt-1 flex items-center gap-1",
          isUser ? "justify-end" : "justify-start"
        )}>
          <Clock className="h-2.5 w-2.5" />
          <span>{formattedTime}</span>
        </div>
      </div>
      
      {isUser && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
} 