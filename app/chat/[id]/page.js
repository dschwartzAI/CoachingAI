import ChatLayout from "@/components/ChatLayout";

export default async function ChatPage({ params }) {
  const { id } = await params;
  return (
    <main className="flex h-screen">
      <ChatLayout initialChatId={id} />
    </main>
  );
}
