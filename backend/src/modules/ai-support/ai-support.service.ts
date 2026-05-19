import { Injectable, Logger } from '@nestjs/common';
import { SupportService } from '../support/support.service';
import { TicketCategory, TicketPriority, type CreateTicketDto } from '../support/dto/create-ticket.dto';
import { ChatAiSupportDto } from './dto/chat-ai-support.dto';
import { EscalateAiSupportDto } from './dto/escalate-ai-support.dto';
import { AiSupportFeedbackDto } from './dto/ai-support-feedback.dto';
import { CustomerAiPolicyService } from './customer-ai-policy.service';
import { CustomerAiToolsService } from './customer-ai-tools.service';
import type {
  AiSupportConfidence,
  CustomerAiAction,
  CustomerAiContextSummary,
  CustomerAiReply,
} from './types';

type AiActor = {
  id: string;
  role: string;
};

type ParsedModelReply = {
  reply?: string;
  confidence?: string;
  escalationSuggested?: boolean;
  escalationDesk?: string;
  ticketDraftMessage?: string;
};

@Injectable()
export class AiSupportService {
  private readonly logger = new Logger(AiSupportService.name);

  constructor(
    private readonly policy: CustomerAiPolicyService,
    private readonly tools: CustomerAiToolsService,
    private readonly supportService: SupportService,
  ) {}

  async chat(actor: AiActor, dto: ChatAiSupportDto): Promise<CustomerAiReply> {
    const restrictedReply = this.policy.evaluateRestriction(dto.message);
    if (restrictedReply) {
      return restrictedReply;
    }

    const context = await this.tools.buildContext(actor.id, dto);
    const fallback = this.buildFallbackReply(dto, context);

    if (!process.env.OPENAI_API_KEY) {
      return fallback;
    }

    try {
      const modelReply = await this.callOpenAi(dto, context, fallback);
      return {
        ...fallback,
        source: 'OPENAI',
        reply: modelReply.reply?.trim() || fallback.reply,
        confidence: this.normalizeConfidence(modelReply.confidence, fallback.confidence),
        escalationSuggested:
          typeof modelReply.escalationSuggested === 'boolean'
            ? modelReply.escalationSuggested
            : fallback.escalationSuggested,
        escalationDesk: modelReply.escalationDesk?.trim() || fallback.escalationDesk,
        ticketDraftMessage:
          modelReply.ticketDraftMessage?.trim() || fallback.ticketDraftMessage,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`OpenAI support fallback used: ${message}`);
      return fallback;
    }
  }

  async escalate(actor: AiActor, dto: EscalateAiSupportDto) {
    const category = dto.category ?? this.inferCategory(dto.message);
    const priority = dto.priority ?? this.inferPriority(dto.message);

    const ticketDto: CreateTicketDto = {
      bookingId: dto.bookingId,
      sourceContextType: dto.sourceContextType ?? (dto.bookingId ? 'BOOKING' : undefined),
      sourceContextId: dto.sourceContextId ?? dto.bookingId,
      category,
      priority,
      message: dto.message,
      autobotSummary: dto.aiSummary,
      autobotArticle: 'Zito Assistant',
      autobotConfidence: dto.aiConfidence,
      autobotQuickAction: 'Create support draft',
      autobotEscalationDesk: dto.aiEscalationDesk,
      autobotSuggestedReply: dto.aiSuggestedReply,
    };

    const ticket = await this.supportService.create(actor.id, ticketDto);
    return {
      message: 'Support ticket created from Zito Assistant.',
      ticket,
    };
  }

  async feedback(actor: AiActor, dto: AiSupportFeedbackDto) {
    this.logger.log(
      `Customer AI feedback from ${actor.id}: helpful=${dto.helpful} conversation=${dto.conversationId ?? 'n/a'} comment=${dto.comment ?? ''}`,
    );

    return {
      received: true,
      helpful: dto.helpful,
    };
  }

  private inferCategory(message: string): TicketCategory {
    if (/(payment|invoice|refund|wallet|mpesa|receipt)/i.test(message)) {
      return TicketCategory.PAYMENT;
    }

    if (/(driver|courier|rider|vehicle|pickup|delivery|track|booking)/i.test(message)) {
      return TicketCategory.BOOKING;
    }

    return TicketCategory.GENERAL;
  }

  private inferPriority(message: string): TicketPriority {
    if (/(urgent|emergency|sos|stuck|critical)/i.test(message)) {
      return TicketPriority.URGENT;
    }
    if (/(failed|blocked|cannot|can't|unable|delay|delayed|problem)/i.test(message)) {
      return TicketPriority.HIGH;
    }
    if (/(question|guide|help|how)/i.test(message)) {
      return TicketPriority.MEDIUM;
    }
    return TicketPriority.LOW;
  }

  private detectIntent(message: string) {
    if (/(payment|invoice|refund|wallet|mpesa|receipt)/i.test(message)) {
      return 'PAYMENT';
    }
    if (/(fleet|vehicle|driver|verification|photo|permit|insurance)/i.test(message)) {
      return 'FLEET';
    }
    if (/(track|where|eta|status|in transit|picked up|delivered)/i.test(message)) {
      return 'TRACKING';
    }
    if (/(book|booking|pickup|drop|route|quote|schedule)/i.test(message)) {
      return 'BOOKING';
    }
    if (/(support|ticket|agent|human|help desk)/i.test(message)) {
      return 'SUPPORT';
    }
    return 'GENERAL';
  }

  private buildFallbackReply(
    dto: ChatAiSupportDto,
    context: CustomerAiContextSummary,
  ): CustomerAiReply {
    const intent = this.detectIntent(dto.message);
    const selectedBooking = context.selectedBooking;

    switch (intent) {
      case 'TRACKING':
        return {
          source: 'FALLBACK',
          reply: selectedBooking
            ? `Booking ${selectedBooking.reference} is currently ${selectedBooking.status}. Open live tracking to see the latest route, ETA, and status timeline.`
            : 'Open tracking and choose the active booking you want to follow. If the trip is delayed or unclear, create a support ticket from the same customer support workspace.',
          confidence: selectedBooking ? 'HIGH' : 'MEDIUM',
          category: 'BOOKING',
          priority: 'MEDIUM',
          escalationSuggested: !selectedBooking,
          escalationDesk: 'Booking Control',
          bookingId: selectedBooking?.id ?? dto.bookingId ?? null,
          ticketDraftMessage: selectedBooking
            ? `Customer needs help understanding the live tracking or status of booking ${selectedBooking.reference}. Original message: ${dto.message}`
            : `Customer needs help with tracking visibility or trip status. Original message: ${dto.message}`,
          actions: [
            { kind: 'OPEN_TRACKING', label: 'Open tracking', href: '/customer/tracking' },
            { kind: 'OPEN_SUPPORT', label: 'Open support', href: '/customer/support' },
          ],
        };
      case 'PAYMENT':
        return {
          source: 'FALLBACK',
          reply: selectedBooking?.latestPayment
            ? `The latest payment for booking ${selectedBooking.reference} is ${selectedBooking.latestPayment.status}. Open Payments to see the booking payment timeline and reference details.`
            : 'Open Payments or Invoices to review booking-linked amounts, status, and references. If something looks wrong, create a payment support ticket from this page.',
          confidence: selectedBooking?.latestPayment ? 'HIGH' : 'MEDIUM',
          category: 'PAYMENT',
          priority: 'MEDIUM',
          escalationSuggested: /(failed|reversed|pending|not received|missing)/i.test(dto.message),
          escalationDesk: 'Payments',
          bookingId: selectedBooking?.id ?? dto.bookingId ?? null,
          ticketDraftMessage: selectedBooking
            ? `Customer needs payment help for booking ${selectedBooking.reference}. Original message: ${dto.message}`
            : `Customer needs help with payment, invoice, or receipt status. Original message: ${dto.message}`,
          actions: [
            { kind: 'OPEN_PAYMENTS', label: 'Open payments', href: '/customer/payments' },
            { kind: 'OPEN_INVOICES', label: 'Open invoices', href: '/customer/invoices' },
          ],
        };
      case 'FLEET':
        return {
          source: 'FALLBACK',
          reply:
            context.ownedFleet.vehicleCount > 0
              ? `Your customer-owned fleet is active with ${context.ownedFleet.vehicleCount} vehicles and ${context.ownedFleet.driverCount} linked drivers. Open Own Fleet to manage vehicles, link drivers from the Zito Partners driver app, and review verification readiness.`
              : 'Customer-owned fleet is available from the customer app. Open Own Fleet to add your vehicles, link drivers who already registered in Zito Partners, and complete verification steps.',
          confidence: 'HIGH',
          category: 'GENERAL',
          priority: 'LOW',
          escalationSuggested: /(rejected|expired|verification|cannot upload)/i.test(dto.message),
          escalationDesk: 'Fleet Verification',
          bookingId: null,
          ticketDraftMessage: `Customer needs help with owned fleet, linked driver accounts, or fleet verification. Original message: ${dto.message}`,
          actions: [
            { kind: 'OPEN_FLEET', label: 'Open own fleet', href: '/customer/fleet' },
            { kind: 'OPEN_SUPPORT', label: 'Open support', href: '/customer/support' },
          ],
        };
      case 'BOOKING':
        return {
          source: 'FALLBACK',
          reply:
            'Start with pickup and drop-off, confirm the route, then choose the vehicle or service. The customer app shows the route and quote, while pricing logic stays hidden behind the scenes.',
          confidence: 'HIGH',
          category: 'BOOKING',
          priority: 'LOW',
          escalationSuggested: /(cannot book|blocked|wrong quote|route issue)/i.test(dto.message),
          escalationDesk: 'Booking Control',
          bookingId: dto.bookingId ?? null,
          ticketDraftMessage: `Customer needs booking help or route support. Original message: ${dto.message}`,
          actions: [
            { kind: 'OPEN_BOOKING', label: 'Open booking', href: '/customer/bookings/new' },
            { kind: 'OPEN_HELP_CENTER', label: 'Open Help Center', href: '/guides/service' },
          ],
        };
      case 'SUPPORT':
        return {
          source: 'FALLBACK',
          reply:
            'You can use Zito Assistant to understand the procedure first, then turn the issue into a support draft for the human desk without repeating everything manually.',
          confidence: 'HIGH',
          category: 'GENERAL',
          priority: 'MEDIUM',
          escalationSuggested: true,
          escalationDesk: 'Customer Care',
          bookingId: dto.bookingId ?? null,
          ticketDraftMessage: `Customer requested human support. Original message: ${dto.message}`,
          actions: [
            { kind: 'OPEN_SUPPORT', label: 'Open support', href: '/customer/support' },
            { kind: 'OPEN_HELP_CENTER', label: 'Open Help Center', href: '/guides/service' },
          ],
        };
      default:
        return {
          source: 'FALLBACK',
          reply:
            'I can help with booking steps, tracking, payments, invoices, support, and your owned fleet. Choose the closest quick action or ask a more specific question.',
          confidence: 'MEDIUM',
          category: 'GENERAL',
          priority: 'LOW',
          escalationSuggested: false,
          escalationDesk: 'Customer Care',
          bookingId: dto.bookingId ?? null,
          ticketDraftMessage: `Customer needs general procedure guidance. Original message: ${dto.message}`,
          actions: [
            { kind: 'OPEN_BOOKING', label: 'Open booking', href: '/customer/bookings/new' },
            { kind: 'OPEN_TRACKING', label: 'Open tracking', href: '/customer/tracking' },
            { kind: 'OPEN_SUPPORT', label: 'Open support', href: '/customer/support' },
          ],
        };
    }
  }

  private async callOpenAi(
    dto: ChatAiSupportDto,
    context: CustomerAiContextSummary,
    fallback: CustomerAiReply,
  ) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SUPPORT_MODEL || 'gpt-5-mini',
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: this.policy.buildSystemPrompt(),
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: [
                  `Customer message: ${dto.message}`,
                  dto.screenContext ? `Screen context: ${dto.screenContext}` : null,
                  `Fallback category: ${fallback.category}`,
                  `Fallback priority: ${fallback.priority}`,
                  `Allowed actions: ${fallback.actions.map((action) => `${action.label} -> ${action.href}`).join(' | ')}`,
                  `Customer-safe live context: ${JSON.stringify(context)}`,
                  'Return JSON only with reply, confidence, escalationSuggested, escalationDesk, and ticketDraftMessage.',
                ]
                  .filter(Boolean)
                  .join('\n'),
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = this.extractResponseText(payload);
    const parsed = this.extractJson(text);
    if (!parsed) {
      throw new Error('OpenAI response could not be parsed as JSON');
    }

    return parsed;
  }

  private extractResponseText(payload: Record<string, unknown>) {
    if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
      return payload.output_text.trim();
    }

    const output = Array.isArray(payload.output) ? payload.output : [];
    const chunks: string[] = [];

    for (const item of output) {
      const content = Array.isArray((item as Record<string, unknown>).content)
        ? ((item as Record<string, unknown>).content as Array<Record<string, unknown>>)
        : [];

      for (const block of content) {
        if (typeof block.text === 'string') {
          chunks.push(block.text);
          continue;
        }

        const nestedText = block.text as Record<string, unknown> | undefined;
        if (nestedText && typeof nestedText.value === 'string') {
          chunks.push(nestedText.value);
        }
      }
    }

    return chunks.join('\n').trim();
  }

  private extractJson(raw: string): ParsedModelReply | null {
    if (!raw.trim()) {
      return null;
    }

    try {
      return JSON.parse(raw) as ParsedModelReply;
    } catch {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) {
        return null;
      }

      try {
        return JSON.parse(raw.slice(start, end + 1)) as ParsedModelReply;
      } catch {
        return null;
      }
    }
  }

  private normalizeConfidence(value: string | undefined, fallback: AiSupportConfidence): AiSupportConfidence {
    if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH') {
      return value;
    }

    return fallback;
  }
}
