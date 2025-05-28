"use client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowUp } from 'lucide-react';

export default function ChatInputForm({ input, setInput, handleSubmit, handleKeyDown, textareaRef, isLoading, isResponseLoading, isWaitingForN8n }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 md:left-[300px] bg-background border-t p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="flex flex-col space-y-2 mobile-input-wrapper">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="resize-none pr-12 py-3 max-h-32 min-h-[52px] text-base font-medium mobile-input"
            rows={1}
            disabled={isLoading || isResponseLoading || isWaitingForN8n}
            style={{ fontSize: '16px' }}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8 rounded-full"
            disabled={!input.trim() || isLoading || isResponseLoading || isWaitingForN8n}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
