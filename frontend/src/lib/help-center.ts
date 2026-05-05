import { APP_GUIDES, type AppGuide } from '@/lib/user-guides';

export type HelpCenterKey = 'service' | 'partners' | 'internal';

export type HelpCenterQuickAction = {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  keywords: string[];
};

export type HelpCenterContactAction = {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
};

export type HelpCenterArticle = {
  title: string;
  description: string;
  items: string[];
  keywords: string[];
};

export type HelpCenterSuggestion = {
  article: HelpCenterArticle | null;
  quickAction: HelpCenterQuickAction | null;
  summary: string;
  confidence: 'high' | 'medium' | 'low';
};

export type HelpCenterGuide = AppGuide & {
  title: string;
  subtitle: string;
  quickActions: HelpCenterQuickAction[];
  supportAction: HelpCenterContactAction;
  secondaryAction?: HelpCenterContactAction;
  articles: HelpCenterArticle[];
};

function buildArticles(guide: AppGuide): HelpCenterArticle[] {
  return guide.sections.map((section) => ({
    title: section.title,
    description: section.description,
    items: section.items,
    keywords: [
      section.title,
      section.description,
      ...section.items,
      ...guide.roles.flatMap((role) => [role.title, role.summary, ...role.highlights]),
    ].map((value) => value.toLowerCase()),
  }));
}

const AUTOBOT_CATEGORY_HINTS: Record<string, string[]> = {
  BOOKING: ['booking', 'tracking', 'pickup', 'delivery', 'trip', 'route', 'parcel'],
  PAYMENT: ['payment', 'invoice', 'refund', 'wallet', 'billing', 'settlement'],
  DRIVER: ['driver', 'arrival', 'handoff', 'partner', 'vehicle', 'fleet'],
  GENERAL: ['account', 'profile', 'otp', 'login', 'verification', 'support'],
};

function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function scoreKeywords(tokens: string[], keywords: string[]) {
  if (!tokens.length || !keywords.length) {
    return 0;
  }

  const normalizedKeywords = keywords.flatMap((keyword) => tokenize(keyword));
  return tokens.reduce((score, token) => {
    if (normalizedKeywords.includes(token)) {
      return score + 3;
    }

    if (normalizedKeywords.some((keyword) => keyword.startsWith(token) || token.startsWith(keyword))) {
      return score + 1;
    }

    return score;
  }, 0);
}

export function getHelpCenterSuggestion(
  guide: HelpCenterGuide,
  issue: string,
  category?: string,
): HelpCenterSuggestion | null {
  const categoryHints = AUTOBOT_CATEGORY_HINTS[category ?? 'GENERAL'] ?? AUTOBOT_CATEGORY_HINTS.GENERAL;
  const issueTokens = tokenize(issue);
  const tokens = [...issueTokens, ...categoryHints];

  if (!issueTokens.length) {
    return null;
  }

  const rankedArticles = guide.articles
    .map((article) => ({
      article,
      score:
        scoreKeywords(tokens, article.keywords) +
        scoreKeywords(tokens, [article.title, article.description]),
    }))
    .sort((left, right) => right.score - left.score);

  const rankedActions = guide.quickActions
    .map((quickAction) => ({
      quickAction,
      score:
        scoreKeywords(tokens, quickAction.keywords) +
        scoreKeywords(tokens, [quickAction.title, quickAction.description]),
    }))
    .sort((left, right) => right.score - left.score);

  const article = rankedArticles[0]?.score ? rankedArticles[0].article : null;
  const quickAction = rankedActions[0]?.score ? rankedActions[0].quickAction : null;

  if (!article && !quickAction) {
    return null;
  }

  const articleItems = article?.items.slice(0, 2).join(' ') ?? '';
  const actionLine = quickAction
    ? `Suggested next action: ${quickAction.title}.`
    : 'Suggested next action: contact support with the linked workflow context.';

  const summary = [
    article ? `Autobot matched "${article.title}". ${article.description}` : null,
    articleItems ? `Key guidance: ${articleItems}` : null,
    actionLine,
  ]
    .filter(Boolean)
    .join(' ');

  const highestScore = Math.max(rankedArticles[0]?.score ?? 0, rankedActions[0]?.score ?? 0);
  const confidence = highestScore >= 18 ? 'high' : highestScore >= 10 ? 'medium' : 'low';

  return {
    article,
    quickAction,
    summary,
    confidence,
  };
}

export const APP_HELP_CENTERS: Record<HelpCenterKey, HelpCenterGuide> = {
  service: {
    ...APP_GUIDES.service,
    title: 'Zito Logistics Help Center',
    subtitle:
      'Search customer and corporate help by workflow. Start with the right article, then move into support only when the issue needs action.',
    quickActions: [
      {
        title: 'Login & OTP help',
        description: 'Troubleshoot phone OTP, email OTP, password continuation, and session recovery.',
        href: '/login',
        ctaLabel: 'Open login',
        keywords: ['login', 'otp', 'password', 'session', 'signin', 'verification'],
      },
      {
        title: 'Create a booking',
        description: 'Open booking flow, review route rules, and confirm pricing inputs.',
        href: '/customer/bookings/new',
        ctaLabel: 'Open new booking',
        keywords: ['booking', 'quote', 'pricing', 'pickup', 'dropoff', 'county', 'route'],
      },
      {
        title: 'Track or raise support',
        description: 'Move from live tracking into customer support with booking context attached.',
        href: '/customer/support',
        ctaLabel: 'Open support',
        keywords: ['tracking', 'support', 'ticket', 'delivery issue', 'driver issue'],
      },
      {
        title: 'Review payments',
        description: 'Check wallet, invoice visibility, payment status, and finance questions.',
        href: '/customer/payments',
        ctaLabel: 'Open payments',
        keywords: ['payment', 'invoice', 'wallet', 'refund', 'settlement'],
      },
    ],
    supportAction: {
      title: 'Need a human to act on this?',
      description:
        'Open the customer support desk when the article is not enough, the booking is live, or money/document action is required.',
      href: '/customer/support',
      ctaLabel: 'Open customer support',
    },
    secondaryAction: {
      title: 'Need live trip context first?',
      description: 'Go to tracking before opening a ticket when the issue is tied to one active delivery.',
      href: '/customer/tracking',
      ctaLabel: 'Open tracking',
    },
    articles: buildArticles(APP_GUIDES.service),
  },
  partners: {
    ...APP_GUIDES.partners,
    title: 'Zito Partners Help Center',
    subtitle:
      'Search partner help by role and operational task. Use this before escalating jobs, fleet, scan, or warehouse issues.',
    quickActions: [
      {
        title: 'Partner login help',
        description: 'Troubleshoot OTP, email continuation, and partner sign-in routing.',
        href: '/partners/login',
        ctaLabel: 'Open partner login',
        keywords: ['login', 'otp', 'partner', 'signin', 'email', 'session'],
      },
      {
        title: 'Partner registration',
        description: 'Start or review driver, agent, transporter, courier-company, and warehouse-partner registration.',
        href: '/partners/select-role',
        ctaLabel: 'Choose partner role',
        keywords: ['registration', 'partner role', 'driver', 'agent', 'transporter', 'courier', 'warehouse'],
      },
      {
        title: 'Fleet and compliance',
        description: 'Open owned-fleet operations for vehicle management, onboarding, and verification.',
        href: '/transporter/fleet',
        ctaLabel: 'Open fleet workspace',
        keywords: ['fleet', 'vehicle', 'verification', 'photos', 'driver onboarding', 'transport'],
      },
      {
        title: 'Courier operations',
        description: 'Go to courier-company workflow for dispatch, scan ops, and waybill execution.',
        href: '/courier-company/bookings',
        ctaLabel: 'Open courier operations',
        keywords: ['courier', 'scan', 'waybill', 'dispatch', 'bookings'],
      },
    ],
    supportAction: {
      title: 'Need operational intervention?',
      description:
        'Sign in to the relevant partner workspace first, then move into fleet, bookings, scans, or support-linked workflows with your role context.',
      href: '/partners/login',
      ctaLabel: 'Sign in to partner workspace',
    },
    secondaryAction: {
      title: 'Need role clarification first?',
      description: 'Use the role selector when the issue is actually choosing the right partner registration or workspace.',
      href: '/partners/select-role',
      ctaLabel: 'Open role selector',
    },
    articles: buildArticles(APP_GUIDES.partners),
  },
  internal: {
    ...APP_GUIDES.internal,
    title: 'Zito Internal Help Center',
    subtitle:
      'Search internal help by desk and operational responsibility. Start here before escalating into admin, support, or accounts workflows.',
    quickActions: [
      {
        title: 'Internal access help',
        description: 'Troubleshoot internal OTP, role routing, and staff-scope sign-in issues.',
        href: '/internal/login',
        ctaLabel: 'Open internal login',
        keywords: ['internal login', 'otp', 'head office', 'admin', 'staff', 'access'],
      },
      {
        title: 'Customer care queue',
        description: 'Go straight to the customer-care desk for tickets, escalations, and issue ownership.',
        href: '/staff/support',
        ctaLabel: 'Open support desk',
        keywords: ['support', 'customer care', 'ticket', 'escalation', 'handoff'],
      },
      {
        title: 'Accounts desk',
        description: 'Open invoices, payment control, refund, and finance workflow views.',
        href: '/staff/accounts',
        ctaLabel: 'Open accounts desk',
        keywords: ['accounts', 'invoice', 'payment', 'refund', 'finance'],
      },
      {
        title: 'Admin control center',
        description: 'Open the platform control workspace for approvals, monitoring, and governance.',
        href: '/admin',
        ctaLabel: 'Open admin',
        keywords: ['admin', 'verification', 'marketplace', 'alerts', 'system health', 'control'],
      },
    ],
    supportAction: {
      title: 'Need another internal team?',
      description:
        'Move into the support desk when the issue needs human ownership, escalation notes, or a controlled handoff to operations/accounts.',
      href: '/staff/support',
      ctaLabel: 'Open internal support',
    },
    secondaryAction: {
      title: 'Need to re-enter the internal portal?',
      description: 'Return to the private login if the issue is about access, role routing, or session expiry.',
      href: '/internal/login',
      ctaLabel: 'Back to internal login',
    },
    articles: buildArticles(APP_GUIDES.internal),
  },
};
