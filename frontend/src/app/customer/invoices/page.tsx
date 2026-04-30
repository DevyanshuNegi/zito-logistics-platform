import { SelfInvoicesWorkspace } from '@/components/finance/SelfInvoicesWorkspace';

export default function CustomerInvoicesPage() {
  return (
    <SelfInvoicesWorkspace
      title="Customer invoices"
      description="Issued invoices generated from completed transport, courier, warehouse, and owned-fleet platform-fee activity."
      listPath="/customer/invoices"
      pdfPathPrefix="/customer/invoices"
      emptyMessage="No invoices have been generated yet."
    />
  );
}
