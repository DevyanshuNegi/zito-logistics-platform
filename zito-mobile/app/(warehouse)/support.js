import React from 'react';
import PartnerSupportInbox from '../../src/components/PartnerSupportInbox';

export default function WarehouseSupportScreen() {
  return (
    <PartnerSupportInbox
      title="Warehouse Support"
      subtitle="Raise storage, capacity, dispatch, or reconciliation issues from the warehouse partner desk."
      sourceContextType="WAREHOUSE_MOBILE"
    />
  );
}
