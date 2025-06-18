"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import FeedbackModal from "./FeedbackModal";

export default function FeedbackButton() {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-1.5 px-3 h-9"
        onClick={() => setShowFeedbackModal(true)}
      >
        <MessageSquare className="h-4 w-4" />
        <span className="text-sm font-medium">Feedback</span>
      </Button>

      <FeedbackModal
        open={showFeedbackModal}
        onOpenChange={setShowFeedbackModal}
      />
    </>
  );
} 