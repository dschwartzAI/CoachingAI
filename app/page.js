import { Suspense } from "react";
import ChatLayout from "@/components/ChatLayout";
import { FullPageLoading } from "@/components/ui/loading";

export default function Home() {
  return (
    <main className="flex h-screen">
      <Suspense fallback={<FullPageLoading />}>
        <ChatLayout />
      </Suspense>
    </main>
  );
}
