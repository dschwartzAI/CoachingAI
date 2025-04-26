import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function LoadingMessage() {
  return (
    <div className="flex items-start gap-3 max-w-[85%] self-start mr-auto py-3">
      {/* Avatar */}
      <Avatar className="h-10 w-10 flex-shrink-0 border-2 border-primary/30 animate-pulse">
        <AvatarFallback className="bg-primary/20">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
        </AvatarFallback>
      </Avatar>
      
      {/* Message bubble */}
      <div className="bg-muted rounded-2xl rounded-tl-none p-4 min-w-[200px] shadow-sm">
        {/* Content with animated loading bars */}
        <div className="space-y-3">
          <div className="h-3 bg-primary/20 rounded-full w-3/4 animate-pulse" />
          <div className="h-3 bg-primary/15 rounded-full w-1/2 animate-pulse" />
          <div className="h-3 bg-primary/25 rounded-full w-5/6 animate-pulse" />
          <div className="h-3 bg-primary/10 rounded-full w-2/3 animate-pulse" />
        </div>
        
        {/* Status text */}
        <div className="mt-3 text-xs text-muted-foreground flex items-center">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          <span>AI is responding...</span>
        </div>
      </div>
    </div>
  );
} 