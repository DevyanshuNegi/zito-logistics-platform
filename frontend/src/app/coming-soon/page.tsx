import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const metadata = {
  title: 'Coming Soon - Zito Logistics',
  description: 'Our mobile application is currently under development.',
};

export default function ComingSoonPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4 text-center text-zinc-50 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-zinc-950 to-zinc-950"></div>
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-cyan-600/10 blur-[100px]"></div>
      
      <div className="relative z-10 mx-auto max-w-md space-y-8">
        <div className="space-y-4">
          <h1 className="bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl">
            Coming soon
          </h1>
          <p className="text-lg text-zinc-400">
            We are working hard to bring the full Zito ecosystem directly to your device. The mobile app will be available shortly.
          </p>
        </div>

        <div className="pt-8">
          <Link href="/">
            <Button variant="secondary" className="gap-2 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
