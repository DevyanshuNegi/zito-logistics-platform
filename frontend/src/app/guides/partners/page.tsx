import { AppGuidePage } from '@/components/guides/AppGuidePage';
import { APP_HELP_CENTERS } from '@/lib/help-center';

export default function PartnersGuidePage() {
  return (
    <AppGuidePage
      guide={APP_HELP_CENTERS.partners}
      backHref="/partners/login"
      backLabel="Back to Zito Partners login"
    />
  );
}
