'use client';

import { useState } from 'react';
import { Truck } from 'lucide-react';
import { CustomerAiAssistant } from '@/components/support/CustomerAiAssistant';
import { OwnedFleetWorkspace } from '@/components/operations/OwnedFleetWorkspace';
import { FleetDriverManager } from '@/components/operations/FleetDriverManager';

const EMPTY_VEHICLES: never[] = [];

const fleetAiQuickActions = [
  {
    label: 'Add my vehicle',
    message: 'Show me the correct customer-owned fleet procedure for adding a vehicle.',
  },
  {
    label: 'Link my driver',
    message: 'Show me how to link a driver who already registered in the Zito Partners driver app.',
  },
  {
    label: 'Verification help',
    message: 'Explain the customer-owned vehicle verification and photo requirements.',
  },
  {
    label: 'Use fleet in booking',
    message: 'Explain how my customer-owned fleet is used during customer booking and operations.',
  },
] as const;

export default function CustomerFleetPage() {
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#eef4ff] text-[#1b3f72]">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Own fleet
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[#1a1a2e]">
              Manage your own vehicles and linked driver accounts inside the customer app
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">
              Customer-owned fleets can keep vehicle records, link drivers who
              already registered in Zito Partners, and assign those drivers to
              approved vehicles while the drivers continue signing in through
              the separate driver app.
            </p>
          </div>
        </div>
      </section>

      <CustomerAiAssistant
        compact
        screenContext="CUSTOMER_FLEET"
        title="Need help with your own fleet?"
        description="Ask about adding vehicles, linking existing drivers, verification steps, or how customer-owned fleet works inside the Zito customer app. Zito Assistant stays on customer procedure."
        quickActions={fleetAiQuickActions}
        placeholder="Example: What photos do I need for vehicle verification, or how do I link my driver's existing account?"
        helpText="Ask about customer-owned vehicles, linked drivers, verification, or owned-fleet booking procedure."
      />

      <OwnedFleetWorkspace
        title="Customer-owned vehicles"
        description="Add your own vehicles when you want to self-manage transport capacity inside Zito while still using the same booking, tracking, and support platform."
        platformFeeCopy="Any customer-facing account records related to your owned-fleet activity will appear in your invoice workspace automatically when they are generated."
        emptyMessage="No customer-owned vehicles exist yet."
        tone="light"
        refreshToken={refreshToken}
        onChange={() => {
          setRefreshToken((current) => current + 1);
        }}
      />

      <FleetDriverManager
        title="Linked driver roster"
        description="Link drivers who already registered in Zito Partners, then place them onto your admin-approved customer-owned vehicles."
        ownerLabel="customer fleet"
        vehicles={EMPTY_VEHICLES}
        tone="light"
        refreshToken={refreshToken}
        onChange={() => {
          setRefreshToken((current) => current + 1);
        }}
      />
    </div>
  );
}
