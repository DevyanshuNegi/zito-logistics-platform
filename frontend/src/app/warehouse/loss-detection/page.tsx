import { LossDetectionWorkspace } from '@/components/operations/LossDetectionWorkspace';

export default function WarehouseLossDetectionPage() {
  return (
    <LossDetectionWorkspace
      title="Warehouse Loss Board"
      description="Report parcel loss, run mismatch checks, and monitor stale inventory from the warehouse side."
    />
  );
}
