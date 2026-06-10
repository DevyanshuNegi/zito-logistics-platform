'use client';

import { useMemo, useState } from 'react';
import {
  Archive,
  Bell,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Home,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Phone,
  Plus,
  Route,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Truck,
  WalletCards,
} from 'lucide-react';

type TabId = 'home' | 'shipments' | 'messages' | 'wallet' | 'settings';

type Shipment = {
  id: string;
  title: string;
  route: string;
  eta: string;
  status: 'In transit' | 'Arriving' | 'Ready' | 'Delayed';
  tone: 'violet' | 'cyan' | 'emerald' | 'amber';
};

const tabs: Array<{ id: TabId; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'shipments', label: 'Shipments', icon: PackageCheck },
  { id: 'messages', label: 'Inbox', icon: MessageCircle },
  { id: 'wallet', label: 'Wallet', icon: WalletCards },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const shipments: Shipment[] = [
  {
    id: 'ZT-1048',
    title: 'Cold-chain parcel',
    route: 'Westlands to JKIA Cargo',
    eta: '18 min',
    status: 'Arriving',
    tone: 'emerald',
  },
  {
    id: 'ZT-1047',
    title: 'Retail restock',
    route: 'Industrial Area to Karen',
    eta: '42 min',
    status: 'In transit',
    tone: 'violet',
  },
  {
    id: 'ZT-1046',
    title: 'Warehouse handoff',
    route: 'Athi River to Upper Hill',
    eta: 'Today, 4:20 PM',
    status: 'Ready',
    tone: 'cyan',
  },
  {
    id: 'ZT-1045',
    title: 'Express documents',
    route: 'CBD to Gigiri',
    eta: 'Needs review',
    status: 'Delayed',
    tone: 'amber',
  },
];

function statusClasses(tone: Shipment['tone']) {
  return {
    violet: 'border-violet-300/30 bg-violet-400/10 text-violet-100',
    cyan: 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100',
    emerald: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-300/30 bg-amber-400/10 text-amber-100',
  }[tone];
}

function TabPanel({ activeTab }: { activeTab: TabId }) {
  if (activeTab === 'messages') {
    return (
      <section className="space-y-3" aria-label="Inbox preview">
        {['Driver reached pickup gate', 'Finance receipt ready', 'KYC review completed'].map((message) => (
          <div key={message} className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-100">
                <Bell className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{message}</p>
                <p className="mt-1 text-xs text-slate-400">Just now</p>
              </div>
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (activeTab === 'wallet') {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5" aria-label="Wallet snapshot">
        <p className="text-sm text-slate-400">Available balance</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight text-white">KES 42,850</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="min-h-11 rounded-2xl bg-violet-500 px-4 text-sm font-semibold text-white transition duration-200 ease-out active:scale-[0.98]">
            Top up
          </button>
          <button className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-white transition duration-200 ease-out active:scale-[0.98]">
            Receipts
          </button>
        </div>
      </section>
    );
  }

  if (activeTab === 'settings') {
    return (
      <section className="space-y-3" aria-label="Settings preview">
        {['Verification', 'Notification preferences', 'Security controls'].map((setting) => (
          <button
            key={setting}
            className="flex min-h-14 w-full items-center justify-between rounded-3xl border border-white/10 bg-white/[0.06] px-4 text-left transition duration-200 ease-out hover:bg-white/[0.09]"
          >
            <span className="text-sm font-semibold text-white">{setting}</span>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </button>
        ))}
      </section>
    );
  }

  return <ShipmentList title={activeTab === 'shipments' ? 'All shipments' : 'Priority shipments'} />;
}

function ShipmentList({ title }: { title: string }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">{title}</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Swipe for quick actions</h2>
        </div>
        <button className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-slate-200 transition duration-200 ease-out active:scale-[0.97]" aria-label="Search shipments">
          <Search className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3">
        {shipments.map((shipment) => (
          <div key={shipment.id} className="overflow-x-auto rounded-3xl [scrollbar-width:none]">
            <div className="flex min-w-[calc(100%+176px)] snap-x snap-mandatory">
              <button className="min-h-[112px] w-[88px] shrink-0 snap-start bg-cyan-500/90 text-sm font-semibold text-white">
                <Navigation className="mx-auto mb-2 h-5 w-5" />
                Track
              </button>
              <article className="min-h-[112px] flex-1 snap-start border-y border-white/10 bg-white/[0.07] p-4 shadow-md shadow-black/20">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-400">{shipment.id}</p>
                    <h3 className="mt-1 text-base font-semibold text-white">{shipment.title}</h3>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                      <MapPin className="h-4 w-4 text-violet-200" />
                      {shipment.route}
                    </p>
                  </div>
                  <span className={['inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold', statusClasses(shipment.tone)].join(' ')}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {shipment.status}
                  </span>
                </div>
                <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <Clock3 className="h-4 w-4" />
                  ETA {shipment.eta}
                </p>
              </article>
              <button className="min-h-[112px] w-[88px] shrink-0 snap-end bg-emerald-500/90 text-sm font-semibold text-white">
                <Phone className="mx-auto mb-2 h-5 w-5" />
                Call
              </button>
              <button className="min-h-[112px] w-[88px] shrink-0 snap-end bg-slate-800 text-sm font-semibold text-white">
                <Archive className="mx-auto mb-2 h-5 w-5" />
                Archive
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MobilePwaExperience() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const activeTabLabel = useMemo(
    () => tabs.find((tab) => tab.id === activeTab)?.label ?? 'Home',
    [activeTab],
  );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 shadow-2xl shadow-black/40 md:max-w-lg">
        <header className="flex items-center justify-between px-5 pt-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">ZITO PWA</p>
            <h1 className="mt-1 text-xl font-semibold text-white">{activeTabLabel}</h1>
          </div>
          <button className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white transition duration-200 ease-out active:scale-[0.97]" aria-label="Create shipment">
            <Plus className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-28 pt-5">
          <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-violet-500 via-slate-800 to-cyan-500 p-5 shadow-xl shadow-violet-950/40">
            <div className="absolute right-[-2rem] top-[-2rem] h-32 w-32 rounded-full bg-white/15 blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  <ShieldCheck className="h-4 w-4" />
                  Verified flow
                </span>
                <Truck className="h-7 w-7 text-white/90" />
              </div>
              <h2 className="mt-8 max-w-xs text-3xl font-semibold tracking-tight text-white">
                Your logistics day, compressed into one clean view.
              </h2>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  ['12', 'Active'],
                  ['4', 'Arriving'],
                  ['98%', 'On time'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl bg-white/15 p-3 backdrop-blur">
                    <p className="text-lg font-semibold text-white">{value}</p>
                    <p className="mt-1 text-xs text-white/75">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: 'Route', icon: Route },
              { label: 'Inventory', icon: Boxes },
              { label: 'Support', icon: MessageCircle },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  className="min-h-20 rounded-3xl border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold text-white transition duration-200 ease-out hover:bg-white/[0.09] active:scale-[0.97]"
                >
                  <Icon className="mx-auto mb-2 h-5 w-5 text-violet-200" />
                  {action.label}
                </button>
              );
            })}
          </div>

          <div className="mt-6 [animation:pwa-panel-in_220ms_ease-out]" key={activeTab}>
            <TabPanel activeTab={activeTab} />
          </div>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:max-w-lg" aria-label="PWA bottom navigation">
          <div className="grid grid-cols-5 rounded-[1.5rem] border border-white/10 bg-slate-950/90 p-2 shadow-2xl shadow-black/50 backdrop-blur">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition duration-200 ease-out active:scale-[0.96]',
                    active
                      ? 'bg-violet-500 text-white shadow-lg shadow-violet-950/40'
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                  ].join(' ')}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </main>
  );
}
