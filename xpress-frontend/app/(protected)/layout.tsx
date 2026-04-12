import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get('xpress_access_token')?.value;

  if (!token) {
    redirect('/login');
  }

  return <>{children}</>;
}
