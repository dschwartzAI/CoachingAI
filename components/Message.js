"use client";
import { MessageCircle, User, Clock, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';
import useSnippets from '@/hooks/use-snippets';
import SnippetModal from './SnippetModal';

// Add a component for rendering markdown messages
function MarkdownMessage({ content }) {
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
  const { addSnippet } = useSnippets();
  const [selection, setSelection] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const handleMouseUp = (e) => {
    const sel = window.getSelection();
    const text = sel.toString().trim();
    if (text) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelection(text);
      setMenuPos({ x: rect.right, y: rect.bottom });
    } else {
      setMenuPos(null);
    }
  };

  const saveSnippet = ({ label, note }) => {
    addSnippet({
      id: Date.now().toString(),
      text: selection,
      label,
      note,
      context: message.thread_id ? `chat ${message.thread_id}` : 'chat',
      createdAt: new Date().toISOString(),
    });
    setSelection(null);
  };

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
      
      <div
        onMouseUp={handleMouseUp}
        className={cn(
          "rounded-2xl p-3 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-none"
            : "bg-muted text-foreground rounded-tl-none overflow-auto"
        )}
      >
        {/* Render content with markdown for assistant messages or as text for users */}
        <div className={isUser ? "whitespace-pre-wrap" : ""}>
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
      {menuPos && selection && (
        <div
          className="absolute z-50 bg-background border rounded shadow px-2 py-1 text-xs"
          style={{ top: menuPos.y, left: menuPos.x }}
        >
          <button onClick={() => { setShowModal(true); setMenuPos(null); }}>Save as Snippet</button>
        </div>
      )}
      {showModal && selection && (
        <SnippetModal
          open={true}
          text={selection}
          onClose={() => { setShowModal(false); setSelection(null); }}
          onSave={(data) => { saveSnippet(data); setShowModal(false); }}
        />
      )}
    </div>
  );
}

