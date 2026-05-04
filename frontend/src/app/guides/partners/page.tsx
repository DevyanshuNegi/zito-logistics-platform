import { AppGuidePage } from '@/components/guides/AppGuidePage';
import { APP_GUIDES } from '@/lib/user-guides';

export default function PartnersGuidePage() {
  return (
    <AppGuidePage
      guide={APP_GUIDES.partners}
      backHref="/partners/login"
      backLabel="Back to Zito Partners login"
    />
  );
}
