import { MessageCircle, User, Clock, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Add a component for rendering markdown messages
function MarkdownMessage({ content }) {
  // Check if content is short and simple (no markdown formatting)
  const isShortSimple = content.length <= 100 && 
    !content.includes('\n') && 
    !content.includes('**') && 
    !content.includes('*') && 
    !content.includes('`') && 
    !content.includes('#') && 
    !content.includes('[') && 
    !content.includes('](') &&
    !content.includes('- ') &&
    !content.includes('1. ');

  // For short, simple messages, render as plain text to avoid paragraph margins
  if (isShortSimple) {
    return <span className="text-base leading-relaxed">{content}</span>;
  }

  // For longer or formatted content, use markdown with proper prose styling
  return (
    <ReactMarkdown
      className="prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:mb-2 prose-headings:mt-4 prose-pre:my-1 max-w-none" 
      remarkPlugins={[remarkGfm]}
    >
      {content}
    </ReactMarkdown>
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
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn(
        "rounded-2xl p-3 text-sm", 
        isUser 
          ? "bg-primary text-primary-foreground rounded-tr-none" 
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