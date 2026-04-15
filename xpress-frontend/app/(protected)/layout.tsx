"use client";

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getValidAccessToken } from '@/lib/auth-client';

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let active = true;
    getValidAccessToken().then((token) => {
      if (!active) return;
      if (!token) {
        router.replace('/login');
      } else {
        setIsChecking(false);
      }
    });
    return () => { active = false; };
  }, [router]);

  if (isChecking) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return <>{children}</>;
}
