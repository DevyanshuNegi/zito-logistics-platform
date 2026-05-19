import { Injectable } from '@nestjs/common';
import { CUSTOMER_AI_SYSTEM_PROMPT } from './customer-ai-prompts';
import type { CustomerAiReply } from './types';

@Injectable()
export class CustomerAiPolicyService {
  private readonly restrictedPatterns = [
    /rate\s*card/i,
    /pricing\s*scope/i,
    /county\s*pricing/i,
    /area\s*type/i,
    /town\s*pricing/i,
    /rural\s*pricing/i,
    /surge\s*(formula|logic|rule)/i,
    /margin/i,
    /commission/i,
    /platform\s*fee\s*(logic|config|formula)/i,
  ];

  buildSystemPrompt() {
    return CUSTOMER_AI_SYSTEM_PROMPT;
  }

  evaluateRestriction(message: string): CustomerAiReply | null {
    if (!this.restrictedPatterns.some((pattern) => pattern.test(message))) {
      return null;
    }

    return {
      source: 'POLICY',
      reply:
        'I can help with booking steps, tracking, payments, invoices, support, and your owned fleet procedure. Internal pricing logic and commercial rules stay hidden from the customer app.',
      confidence: 'HIGH',
      category: 'GENERAL',
      priority: 'LOW',
      escalationSuggested: false,
      escalationDesk: 'Customer Care',
      bookingId: null,
      ticketDraftMessage:
        'Customer asked about internal pricing or commercial logic. Explain that final quote and trip procedure are customer-visible, while pricing rules stay internal.',
      actions: [
        { kind: 'OPEN_BOOKING', label: 'Open booking', href: '/customer/bookings/new' },
        { kind: 'OPEN_SUPPORT', label: 'Open support', href: '/customer/support' },
        { kind: 'OPEN_HELP_CENTER', label: 'Open Help Center', href: '/guides/service' },
      ],
    };
  }
}
