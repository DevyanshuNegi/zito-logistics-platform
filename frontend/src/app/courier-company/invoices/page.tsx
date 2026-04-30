import { SelfInvoicesWorkspace } from '@/components/finance/SelfInvoicesWorkspace';

export default function CourierCompanyInvoicesPage() {
  return (
    <SelfInvoicesWorkspace
      title="Courier-company invoices"
      description="Review issued invoices for courier-company transport, platform-hired capacity, and owned-fleet platform-fee charges."
      listPath="/courier-company/invoices"
      pdfPathPrefix="/courier-company/invoices"
      emptyMessage="No courier-company invoices have been generated yet."
    />
  );
}
