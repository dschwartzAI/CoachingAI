'use client';

import { Progress } from "@/components/ui/progress";
import { getProgress } from "@/lib/config/tools";

export default function ToolProgress({ tool, messages }) {
  if (!tool?.questions) return null;

  const progress = getProgress(tool, messages);
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