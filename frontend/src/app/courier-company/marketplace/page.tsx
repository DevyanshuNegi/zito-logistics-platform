import { PartnerMarketplaceWorkspace } from '@/components/marketplace/PartnerMarketplaceWorkspace';

export default function CourierCompanyMarketplacePage() {
  return (
    <PartnerMarketplaceWorkspace
      title="Courier marketplace"
      profileTitle="Courier-company marketplace profile"
      onboardEndpoint="/marketplace/partner/courier-company/onboard"
      showVehicleSelect
    />
  );
}
