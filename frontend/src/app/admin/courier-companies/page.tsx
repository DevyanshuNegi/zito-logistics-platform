'use client';

import { PartnerControlDesk } from '@/components/admin/PartnerControlDesk';

export default function AdminCourierCompaniesPage() {
  return (
    <PartnerControlDesk
      accountRole="COURIER_COMPANY"
      marketplaceType="COURIER_COMPANY"
      title="Courier company control"
      description="Create courier-company accounts, review their marketplace posture, supervise owned fleet linkage, and keep finance visibility inside the same internal control layer."
      accountLabel="Courier company"
      assetSummaryLabel="Fleet assets"
      assetIdLabel="Vehicle"
      secondaryActionHref="/admin/fleet"
      secondaryActionLabel="Fleet control"
    />
  );
}
