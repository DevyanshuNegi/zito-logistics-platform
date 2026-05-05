'use client';

import { PartnerControlDesk } from '@/components/admin/PartnerControlDesk';

export default function AdminWarehousePartnersPage() {
  return (
    <PartnerControlDesk
      accountRole="WAREHOUSE_PARTNER"
      marketplaceType="WAREHOUSE"
      title="Warehouse partner control"
      description="Create warehouse-partner accounts, review marketplace readiness, supervise managed sites, and watch finance exposure without leaving the admin and super-admin control surface."
      accountLabel="Warehouse partner"
      assetSummaryLabel="Open balance"
      assetIdLabel="Warehouse"
      secondaryActionHref="/admin/agencies"
      secondaryActionLabel="Agencies & capacity"
    />
  );
}
