import { PartnerMarketplaceWorkspace } from '@/components/marketplace/PartnerMarketplaceWorkspace';

export default function TransporterMarketplacePage() {
  return (
    <PartnerMarketplaceWorkspace
      title="Transporter marketplace"
      profileTitle="Transporter marketplace profile"
      onboardEndpoint="/marketplace/partner/transporter/onboard"
      showVehicleSelect
    />
  );
}
