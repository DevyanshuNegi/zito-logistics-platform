import { PartnerMarketplaceWorkspace } from '@/components/marketplace/PartnerMarketplaceWorkspace';

export default function WarehouseMarketplacePage() {
  return (
    <PartnerMarketplaceWorkspace
      title="Warehouse marketplace"
      profileTitle="Warehouse marketplace profile"
      onboardEndpoint="/marketplace/partner/warehouse/onboard"
    />
  );
}
