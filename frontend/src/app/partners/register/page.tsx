import RegisterPageClient from '@/app/(auth)/register/RegisterPageClient';

type PartnerRegisterPageProps = {
  searchParams?: {
    role?: string;
  };
};

export default function PartnerRegisterPage({ searchParams }: PartnerRegisterPageProps) {
  return (
    <RegisterPageClient
      initialRole={searchParams?.role ?? null}
      portalKind="partners"
    />
  );
}
