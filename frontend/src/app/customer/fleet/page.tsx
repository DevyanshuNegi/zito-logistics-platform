import { OwnedFleetWorkspace } from '@/components/operations/OwnedFleetWorkspace';

export default function CustomerFleetPage() {
  return (
    <OwnedFleetWorkspace
      title="Customer-owned vehicles"
      description="Add your own vehicles when you want to self-manage transport capacity inside Zito while still using the same booking, tracking, and support platform."
      platformFeeCopy="Platform-fee automation is active for owned-fleet billing. Customer fleets default to per-vehicle charging, and generated fee invoices appear in your invoice workspace."
      emptyMessage="No customer-owned vehicles exist yet."
    />
  );
}
