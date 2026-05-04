'use client';

import { useState } from 'react';
import { Truck } from 'lucide-react';
import { OwnedFleetWorkspace } from '@/components/operations/OwnedFleetWorkspace';
import { FleetDriverManager } from '@/components/operations/FleetDriverManager';

const EMPTY_VEHICLES: never[] = [];

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
              Manage your own vehicles and drivers inside the customer app
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">
              Customer-owned fleets can keep vehicle records, onboard their own
              drivers, and assign those drivers to vehicles while the drivers
              still sign in through the separate driver app.
            </p>
          </div>
        </div>
      </section>

      <OwnedFleetWorkspace
        title="Customer-owned vehicles"
        description="Add your own vehicles when you want to self-manage transport capacity inside Zito while still using the same booking, tracking, and support platform."
        platformFeeCopy="Platform-fee automation is active for owned-fleet billing. Customer fleets default to per-vehicle charging, and generated fee invoices appear in your invoice workspace."
        emptyMessage="No customer-owned vehicles exist yet."
        tone="light"
        refreshToken={refreshToken}
        onChange={() => {
          setRefreshToken((current) => current + 1);
        }}
      />

      <FleetDriverManager
        title="Customer-managed driver roster"
        description="Create customer-owned driver accounts, keep them ready for operations, and place them onto your owned vehicles."
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
