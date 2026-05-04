import { AppGuidePage } from '@/components/guides/AppGuidePage';
import { APP_GUIDES } from '@/lib/user-guides';

export default function InternalGuidePage() {
  return (
    <AppGuidePage
      guide={APP_GUIDES.internal}
      backHref="/internal/login"
      backLabel="Back to Zito Internal login"
    />
  );
}
