import RegisterPageClient from './RegisterPageClient';

type RegisterPageProps = {
  searchParams?: {
    role?: string;
  };
};

export default function RegisterPage({ searchParams }: RegisterPageProps) {
  return (
    <RegisterPageClient
      initialRole={searchParams?.role ?? null}
      portalKind="service"
    />
  );
}
