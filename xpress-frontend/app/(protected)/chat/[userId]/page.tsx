import { redirect } from 'next/navigation';

interface ChatLegacyUserPageProps {
  params: Promise<{ userId: string }>;
}

export default async function ChatLegacyUserPage({ params }: ChatLegacyUserPageProps) {
  const { userId } = await params;
  redirect(`/chat/me?peerUserId=${encodeURIComponent(userId)}`);
}
