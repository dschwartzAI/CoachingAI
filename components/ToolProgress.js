'use client';

import { Progress } from "@/components/ui/progress";
import { getProgress } from "@/lib/config/tools";

export default function ToolProgress({ tool, messages, thread }) {
  if (!tool?.questions) return null;

  // Use the questionsAnswered from the thread if available, otherwise calculate from messages
  let progress;
  if (thread?.questionsAnswered !== undefined) {
    // Use the more accurate questionsAnswered count
    const current = thread.questionsAnswered;
    const total = tool.questions.length;
    const isComplete = current >= total;
    progress = { current, total, isComplete };
  } else {
    // Fall back to the original calculation
    progress = getProgress(tool, messages);
  }
  
  const percentage = (progress.current / progress.total) * 100;

  return (
    <div className="p-4 border-b">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium">Progress</span>
        <span className="text-sm text-muted-foreground">
          {progress.current} of {progress.total} questions answered
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
      {progress.isComplete && (
        <p className="mt-2 text-sm text-muted-foreground">
          All questions answered! Generating your documents...
        </p>
      )}
    </div>
  );
} 