import React from 'react';
import { OwnedFleetScreen } from '../../src/components/OwnedFleetScreen';

export default function CustomerFleetScreen() {
  return (
    <OwnedFleetScreen
      title="Owned Fleet"
      subtitle="Register customer-owned vehicles and manage self-operated capacity inside Zito."
      feeNote="Per-vehicle or per-fleet platform fees are part of the new PRD addendum. Fleet ownership is live here; automated fee charging still depends on the finance layer."
      emptyText="No customer-owned vehicles have been added yet."
    />
  );
}
