import { OwnedFleetWorkspace } from '@/components/operations/OwnedFleetWorkspace';

export default function CourierCompanyFleetPage() {
  return (
    <OwnedFleetWorkspace
      title="Courier-company fleet"
      description="Courier partners can register their own vehicles here, blend them with platform-hired capacity, and keep fleet visibility inside the same Zito operations workspace."
      platformFeeCopy="Owned courier-company fleet is live and platform-fee automation is now active. Courier-company accounts default to a per-fleet invoice model, while finance can still override the billing mode when needed."
      emptyMessage="No courier-company vehicles are registered yet."
    />
  );
}
