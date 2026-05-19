export type CustomerAiAction = {
  kind:
    | 'OPEN_BOOKING'
    | 'OPEN_TRACKING'
    | 'OPEN_PAYMENTS'
    | 'OPEN_INVOICES'
    | 'OPEN_SUPPORT'
    | 'OPEN_FLEET'
    | 'OPEN_HELP_CENTER';
  label: string;
  href: string;
};

export type CustomerAiSupportResponse = {
  source: 'OPENAI' | 'FALLBACK' | 'POLICY';
  reply: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  category: 'BOOKING' | 'PAYMENT' | 'DRIVER' | 'GENERAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  escalationSuggested: boolean;
  escalationDesk: string;
  actions: CustomerAiAction[];
  bookingId?: string | null;
  ticketDraftMessage: string;
};

export type CustomerAiDraft = {
  bookingId?: string;
  category: CustomerAiSupportResponse['category'];
  priority: CustomerAiSupportResponse['priority'];
  message: string;
};
