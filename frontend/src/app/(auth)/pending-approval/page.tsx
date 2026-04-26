'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

// ─── Role-specific messages based on PRD v8 roles ─────────────────────────────
const ROLE_INFO: Record<string, { icon: string; title: string; steps: string[]; eta: string }> = {
  Driver: {
    icon: '🚛',
    title: 'Driver Application Under Review',
    steps: [
      'Admin verifies your National ID',
      'Driving licence checked with NTSA',
      'Background check completed',
      'Vehicle assignment ready',
    ],
    eta: 'Usually approved within 1–2 business days',
  },
  Transporter: {
    icon: '🏭',
    title: 'Transporter Application Under Review',
    steps: [
      'Admin verifies your company details',
      'Vehicle documents reviewed',
      'Insurance certificates checked',
      'Fleet registered in the system',
    ],
    eta: 'Usually approved within 2–3 business days',
  },
  Agent: {
    icon: '🤝',
    title: 'Agent Application Under Review',
    steps: [
      'Admin verifies your identity',
      'Agency credentials confirmed',
      'Account permissions configured',
      'Training materials sent to your email',
    ],
    eta: 'Usually approved within 1 business day',
  },
  Customer: {
    icon: '👤',
    title: 'Account Pending Activation',
    steps: [
      'Admin reviews your registration',
      'Account details verified',
      'Booking access enabled',
      'Welcome email sent',
    ],
    eta: 'Usually approved within a few hours',
  },
  'Warehouse Partner': {
    icon: '🏢',
    title: 'Warehouse Partner Under Review',
    steps: [
      'Admin verifies warehouse location',
      'Storage capacity confirmed',
      'Account details verified',
      'Inventory management enabled',
    ],
    eta: 'Usually approved within 2-3 business days'
  }
};

export default function PendingApproval() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  // Allow hydration to match
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const info = user?.role ? ROLE_INFO[user.role] : ROLE_INFO.Customer;
  const displayInfo = info || ROLE_INFO.Customer;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f121c] p-4 text-white font-sans">
      <div className="w-full max-w-[440px] bg-[#181e2d] rounded-[18px] p-9 py-10 shadow-[0_8px_40px_rgba(0,0,0,0.45)] text-center">

        <div className="text-[52px] mb-3">{displayInfo.icon}</div>
        
        <div className="inline-block bg-[rgba(232,160,32,0.12)] border border-[rgba(232,160,32,0.3)] text-[#e8a020] text-xs font-bold px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
          ⏳ PENDING APPROVAL
        </div>
        
        <div className="text-[20px] font-extrabold text-[#e8eaf2] mb-2">
          {displayInfo.title}
        </div>
        
        <div className="text-[14px] text-[#8892a4] mb-6">
          Hello, <strong className="text-[#e8eaf2]">{user?.full_name || 'there'}</strong>!
          Your account is being reviewed.
        </div>

        {/* Approval steps */}
        <div className="bg-[#111621] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 mb-5 text-left">
          <div className="text-xs text-[#545f73] font-semibold mb-3 uppercase tracking-wide">
            Review Checklist
          </div>
          <ul className="space-y-2">
            {displayInfo.steps.map((step, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[rgba(232,160,32,0.4)] shrink-0" />
                <span className="text-[13px] text-[#8892a4]">{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ETA */}
        <div className="bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.15)] rounded-lg py-2.5 px-4 mb-6">
          <div className="text-xs text-[#22c55e]">
            <span className="mr-1">🕐</span> {displayInfo.eta}
          </div>
        </div>

        {/* Support info */}
        <div className="bg-[#111621] rounded-lg p-3 mb-6 text-xs text-[#545f73] leading-relaxed">
          Need help? Contact our support team at{' '}
          <span className="text-[#e8a020]">support@vglogistics.co.ke</span>
          <br />or call <span className="text-[#e8a020]">+254 700 000 000</span>
        </div>

        {/* Actions */}
        <button 
          onClick={() => window.location.reload()}
          className="w-full py-3 bg-[#e8a020] text-[#0f121c] rounded-lg font-bold text-sm mb-3 hover:bg-[#d69010] transition-colors"
        >
          🔄 Check Approval Status
        </button>
        <button 
          onClick={handleLogout}
          className="w-full py-3 bg-transparent border border-[rgba(255,255,255,0.08)] text-[#8892a4] rounded-lg text-[13px] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
        >
          Sign Out
        </button>

      </div>
    </div>
  );
}