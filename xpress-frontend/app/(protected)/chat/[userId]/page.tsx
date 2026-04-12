import { redirect } from 'next/navigation';

export default function ChatLegacyUserPage() {
  redirect('/chat/me');
}
