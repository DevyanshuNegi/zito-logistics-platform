import { SelfInvoicesWorkspace } from '@/components/finance/SelfInvoicesWorkspace';

export default function TransporterInvoicesPage() {
  return (
    <SelfInvoicesWorkspace
      title="Transporter invoices"
      description="Review transporter-side invoices for platform services, owned-fleet access charges, and finance-ready downloads."
      listPath="/transporter/invoices"
      pdfPathPrefix="/transporter/invoices"
      emptyMessage="No transporter invoices have been generated yet."
    />
  );
}
