import React from "react";
import { Loader2 } from "lucide-react";

export function LoadingSpinner({ className, size = "medium" }) {
  const sizeClass = 
    size === "small" ? "h-4 w-4" :
    size === "large" ? "h-10 w-10" :
    "h-6 w-6"; // medium (default)
    
  return (
    <Loader2 className={`animate-spin ${sizeClass} ${className || ""}`} />
  );
}

export function FullPageLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <LoadingSpinner size="large" className="text-primary mb-4" />
      <p className="text-muted-foreground">Loading your account...</p>
    </div>
  );
} 