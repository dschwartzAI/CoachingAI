import { MessageCircle, User, Clock, Bot, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";

export default function Message({ message }) {
  const isUser = message.role === 'user';
  const timestamp = message.timestamp || new Date();
  const formattedTime = format(new Date(timestamp), 'HH:mm');

  return (
    <div className={cn(
      "flex items-start gap-3 max-w-[90%] group relative", 
      isUser ? "self-end ml-auto" : "self-start mr-auto"
    )}>
      <Avatar className={cn(
        "h-8 w-8", 
        isUser ? "order-last" : "order-first"
      )}>
        <AvatarFallback className={isUser ? "bg-primary" : "bg-muted"}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      
      <div className={cn(
        "rounded-lg p-3 relative", 
        isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        {!isUser && <CornerDownRight className="h-3 w-3 absolute -left-1.5 top-3 text-muted" />}
        {isUser && <CornerDownRight className="h-3 w-3 absolute -right-1.5 top-3 rotate-180 text-primary" />}
        
        {message.content}
        
        <div className={cn(
          "text-[10px] opacity-70 mt-1 flex items-center gap-1",
          isUser ? "justify-end" : "justify-start"
        )}>
          <Clock className="h-2.5 w-2.5" />
          <span>{formattedTime}</span>
        </div>
      </div>
    </div>
  );
} 