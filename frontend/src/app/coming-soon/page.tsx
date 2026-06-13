import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const metadata = {
  title: 'Coming Soon - Zito Logistics',
  description: 'Our mobile application is currently under development.',
};

export default function ComingSoonPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4 text-center text-zinc-50 relative overflow-hidden py-16">
      {/* Background gradients */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-zinc-950 to-zinc-950"></div>
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-cyan-600/10 blur-[100px]"></div>
      
      <div className="relative z-10 mx-auto max-w-lg space-y-8 w-full">
        <div className="space-y-4">
          <h1 className="bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl">
            Coming soon
          </h1>
          <p className="text-lg text-zinc-400">
            We are working hard to bring the full Zito ecosystem directly to your device. Join the waitlist to get early access.
          </p>
        </div>

        <form action="mailto:info@zitoafrica.com?subject=Zito App Waitlist Registration" method="post" encType="text/plain" className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-left shadow-xl backdrop-blur-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['Full name', 'name', 'text'],
              ['Company', 'company', 'text'],
              ['Email', 'email', 'email'],
              ['Phone', 'phone', 'tel'],
            ].map(([label, name, type]) => (
              <label key={name} className="block">
                <span className="text-sm font-bold text-zinc-300">{label}</span>
                <input
                  className="mt-2 min-h-12 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  name={name}
                  type={type}
                  required={name === 'name' || name === 'email'}
                />
              </label>
            ))}
          </div>
          <label className="mt-4 block">
            <span className="text-sm font-bold text-zinc-300">User type</span>
            <select name="userType" className="mt-2 min-h-12 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20">
              <option>Customer (Booking cargo)</option>
              <option>Transporter (Fleet owner)</option>
              <option>Enterprise (Logistics management)</option>
            </select>
          </label>
          <button
            type="submit"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          >
            Join waitlist
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <div className="pt-4">
          <Link href="/">
            <Button variant="secondary" className="gap-2 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white mx-auto">
              <ArrowLeft className="h-4 w-4" />
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

