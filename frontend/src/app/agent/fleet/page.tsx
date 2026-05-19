'use client';

import Link from 'next/link';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';

export default function AgentFleetPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Fleet rule"
          value="No ownership"
          helper="Agents do not add or manage owned vehicles in Zito."
          tone="warning"
        />
        <StatCard
          label="Agent focus"
          value="Trip proposals"
          helper="Agents work through marketplace and trip-proposal flows."
          tone="success"
        />
        <StatCard
          label="Ops visibility"
          value="Admin-led"
          helper="Vehicle approval, GPS setup, and onboarding stay with fleet owners and internal ops."
          tone="info"
        />
      </div>

      <Alert title="Agent fleet policy" variant="info">
        Agents do not create vehicles, own vehicle rosters, or manage vehicle approval in Zito. Those steps belong to transporter, customer, courier-company, or corporate fleet owners together with internal operations.
      </Alert>

      <SurfaceCard
        title="Agent vehicle policy"
        description="This workspace is now informational only for agent users."
      >
        <div className="space-y-4 text-sm leading-6 text-slate-300">
          <p>
            Agents participate in supply discovery and trip proposals. They do not
            operate an owned-fleet workspace inside Zito and they do not attach
            drivers or GPS to vehicles from here.
          </p>
          <p>
            If capacity needs to be sourced, continue through the marketplace or
            trip-proposal workflow and let the approved fleet owner handle vehicle
            onboarding and driver linkage.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/agent/marketplace">
              <Button>Open marketplace</Button>
            </Link>
            <Link href="/agent">
              <Button variant="secondary">Back to agent desk</Button>
            </Link>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
