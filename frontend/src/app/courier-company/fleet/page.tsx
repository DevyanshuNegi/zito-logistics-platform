'use client';

import { useState } from 'react';
import { FleetDriverManager } from '@/components/operations/FleetDriverManager';
import { OwnedFleetWorkspace } from '@/components/operations/OwnedFleetWorkspace';

const EMPTY_VEHICLES: never[] = [];

export default function CourierCompanyFleetPage() {
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div className="space-y-6">
      <OwnedFleetWorkspace
        title="Courier-company fleet"
        description="Courier operators register their vehicles here, complete the same approval and GPS workflow, and keep fleet visibility inside the same operations workspace."
        platformFeeCopy="Owned courier-company fleet records still feed internal billing and finance workflows automatically when they are generated."
        emptyMessage="No courier-company vehicles are registered yet."
        refreshToken={refreshToken}
        onChange={() => {
          setRefreshToken((current) => current + 1);
        }}
      />

      <FleetDriverManager
        title="Linked driver roster"
        description="Link drivers who already registered in Zito Partners, then assign them to admin-approved courier-company vehicles."
        ownerLabel="courier-company fleet"
        vehicles={EMPTY_VEHICLES}
        refreshToken={refreshToken}
        onChange={() => {
          setRefreshToken((current) => current + 1);
        }}
      />
    </div>
  );
}
