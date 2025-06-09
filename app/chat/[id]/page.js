import ChatLayout from "@/components/ChatLayout";

export default function ChatPage({ params }) {
  const { id } = params;
  return (
    <main className="flex h-screen">
      <ChatLayout initialChatId={id} />
    </main>
  );
}
