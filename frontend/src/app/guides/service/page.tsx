import { AppGuidePage } from '@/components/guides/AppGuidePage';
import { APP_GUIDES } from '@/lib/user-guides';

export default function ServiceGuidePage() {
  return (
    <AppGuidePage
      guide={APP_GUIDES.service}
      backHref="/login"
      backLabel="Back to Zito Logistics login"
    />
  );
}
