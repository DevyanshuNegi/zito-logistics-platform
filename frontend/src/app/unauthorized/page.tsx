'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getHomePathForRole } from '@/utils/roles';

export default function UnauthorizedPage() {
  const router = useRouter();
  const { user } = useAuth();
  const homePath = getHomePathForRole(user?.role);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#0a0d14] text-[#e8eaf2] font-sans">
      <div className="text-[64px] mb-4">🚫</div>
      <h1 className="text-[28px] font-bold mb-2">Access Denied</h1>
      <p className="text-[#8892a4] mb-8 text-center max-w-md px-4">
        You do not have permission to access the requested page or module. Your role ({user?.role || 'Guest'}) might not be authorized for this operation.
      </p>
      
      <button
        onClick={() => router.push(homePath)}
        className="px-8 py-3 bg-[#e8a020] hover:bg-[#d69010] text-black font-bold text-sm rounded-lg transition-colors"
      >
        Go to Home
      </button>
    </main>
  );
}