import { AppGuidePage } from '@/components/guides/AppGuidePage';
import { APP_HELP_CENTERS } from '@/lib/help-center';

export default function InternalGuidePage() {
  return (
    <AppGuidePage
      guide={APP_HELP_CENTERS.internal}
      backHref="/internal/login"
      backLabel="Back to Zito Internal login"
    />
  );
}
