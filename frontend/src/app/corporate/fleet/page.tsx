import { OwnedFleetWorkspace } from '@/components/operations/OwnedFleetWorkspace';

export default function CorporateFleetPage() {
  return (
    <OwnedFleetWorkspace
      title="Corporate-owned fleet"
      description="Corporate clients can register and manage their internal fleet here while still using Zito for bookings, tracking, billing, and service orchestration."
      platformFeeCopy="Platform-fee automation is active for corporate-owned fleets. Corporate accounts default to a per-fleet subscription invoice, with the amount adjustable by finance at generation time."
      emptyMessage="No corporate fleet vehicles are registered yet."
    />
  );
}
