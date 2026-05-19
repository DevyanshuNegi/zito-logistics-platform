export type AiSupportConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export type CustomerAiActionKind =
  | 'OPEN_BOOKING'
  | 'OPEN_TRACKING'
  | 'OPEN_PAYMENTS'
  | 'OPEN_INVOICES'
  | 'OPEN_SUPPORT'
  | 'OPEN_FLEET'
  | 'OPEN_HELP_CENTER';

export type CustomerAiAction = {
  kind: CustomerAiActionKind;
  label: string;
  href: string;
};

export type CustomerAiReply = {
  source: 'OPENAI' | 'FALLBACK' | 'POLICY';
  reply: string;
  confidence: AiSupportConfidence;
  category: 'BOOKING' | 'PAYMENT' | 'DRIVER' | 'GENERAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  escalationSuggested: boolean;
  escalationDesk: string;
  actions: CustomerAiAction[];
  bookingId?: string | null;
  ticketDraftMessage: string;
};

export type CustomerAiContextSummary = {
  selectedBooking: null | {
    id: string;
    reference: string;
    status: string;
    serviceType: string;
    totalPrice: number;
    stops: Array<{
      sequence: number;
      address: string;
      stopType: string;
    }>;
    latestPayment: null | {
      status: string;
      reference: string | null;
      amount: number;
      method: string;
    };
    invoice: null | {
      number: string;
      status: string;
      totalAmount: number;
      paidAmount: number;
    };
  };
  recentBookings: Array<{
    id: string;
    reference: string;
    status: string;
    serviceType: string;
    createdAt: Date;
  }>;
  recentInvoices: Array<{
    id: string;
    number: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
  }>;
  recentTickets: Array<{
    id: string;
    category: string;
    status: string;
    priority: string;
  }>;
  ownedFleet: {
    vehicleCount: number;
    driverCount: number;
    vehicles: Array<{
      id: string;
      plateNumber: string;
      type: string;
      verificationStatus: string;
      status: string;
    }>;
  };
};
