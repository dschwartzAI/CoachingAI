import { MessageCircle, User, Clock, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";

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
          : "bg-muted text-foreground rounded-tl-none"
      )}>
        <div className="whitespace-pre-wrap">{message.content}</div>
        
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