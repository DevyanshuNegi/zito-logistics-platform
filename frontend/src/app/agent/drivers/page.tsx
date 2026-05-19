'use client';

import Link from 'next/link';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';

export default function AgentDriversPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Driver path"
          value="Partners App"
          helper="Drivers must register and sign in through Zito Partners."
          tone="info"
        />
        <StatCard
          label="Agent rule"
          value="No onboarding"
          helper="Agents do not create or own driver accounts."
          tone="warning"
        />
        <StatCard
          label="Next action"
          value="Propose trips"
          helper="Use marketplace tools to source and propose capacity."
          tone="success"
        />
      </div>

      <Alert title="Driver ownership rule" variant="info">
        Driver accounts are created only by the drivers themselves through the Zito Partners driver app. Agents do not onboard drivers, do not own driver rosters, and do not manage driver activation from this workspace.
      </Alert>

      <SurfaceCard
        title="Agent driver policy"
        description="This workspace is now informational only for agents."
      >
        <div className="space-y-4 text-sm leading-6 text-slate-300">
          <p>
            If a driver wants to work through Zito, the driver must first register in
            the Zito Partners driver app and complete the normal driver-side login
            and profile process.
          </p>
          <p>
            Agents focus on proposing trips, sourcing supply, and participating in
            marketplace workflows. Vehicle ownership, driver linking, and fleet
            approval belong to fleet-owning partner accounts or internal operations.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/agent/marketplace">
              <Button>Open marketplace</Button>
            </Link>
            <Link href="/partners/login">
              <Button variant="secondary">Open partners login</Button>
            </Link>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
