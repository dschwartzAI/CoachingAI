"use server";

import dynamic from "next/dynamic";

const InputTest = dynamic(() => import("@/components/InputTest"), { ssr: false });

export default async function InputTestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <InputTest />
    </div>
  );
} 