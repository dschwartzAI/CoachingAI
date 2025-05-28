"use client";

import { useRef } from "react";

export default function useChatSSE() {
  const eventSourceRef = useRef(null);

  const closeConnection = () => {
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error("[useChatSSE] Error closing SSE", err);
      }
      eventSourceRef.current = null;
    }
  };

  return { eventSourceRef, closeConnection };
}
