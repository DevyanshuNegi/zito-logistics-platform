import React from 'react';
import { OwnedFleetScreen } from '../../src/components/OwnedFleetScreen';

export default function CourierCompanyFleetScreen() {
  return (
    <OwnedFleetScreen
      title="Courier Fleet"
      subtitle="Register courier-company vehicles and blend them with Zito capacity during PTL operations."
      feeNote="Courier-company owned-fleet charging per vehicle or fleet is now part of the PRD addendum. Fleet management is live here; automated billing remains pending."
      emptyText="No courier-company vehicles have been added yet."
    />
  );
}
