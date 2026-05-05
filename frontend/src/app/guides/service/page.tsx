import { AppGuidePage } from '@/components/guides/AppGuidePage';
import { APP_HELP_CENTERS } from '@/lib/help-center';

export default function ServiceGuidePage() {
  return (
    <AppGuidePage
      guide={APP_HELP_CENTERS.service}
      backHref="/login"
      backLabel="Back to Zito Logistics login"
    />
  );
}
