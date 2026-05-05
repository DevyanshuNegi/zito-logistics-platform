import { formatDateTime, formatStatus } from '@/lib/format';

export type SupportThreadAuthor = {
  id?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
};

export type SupportThreadMessage = {
  id: string;
  actorType: string;
  message: string;
  isInternal?: boolean;
  createdAt?: string;
  author?: SupportThreadAuthor | null;
};

type SupportMessageThreadProps = {
  messages: SupportThreadMessage[];
  tone?: 'light' | 'dark';
};

function resolveActorLabel(message: SupportThreadMessage) {
  if (message.isInternal) {
    return 'Internal note';
  }

  if (message.actorType === 'AUTOBOT') {
    return 'Autobot';
  }

  if (message.author?.fullName) {
    return message.author.fullName;
  }

  return formatStatus(message.actorType);
}

export function SupportMessageThread({
  messages,
  tone = 'light',
}: SupportMessageThreadProps) {
  const palette =
    tone === 'light'
      ? {
          thread: 'border-slate-200/90 bg-white/94',
          autobot: 'border-cyan-200 bg-cyan-50 text-slate-800',
          customer: 'border-sky-200 bg-sky-50 text-slate-900',
          staff: 'border-slate-200 bg-slate-50 text-slate-900',
          internal: 'border-amber-200 bg-amber-50 text-slate-900',
          meta: 'text-slate-500',
          body: 'text-slate-700',
          empty: 'border-slate-200 bg-slate-50 text-slate-500',
        }
      : {
          thread: 'border-slate-800/80 bg-slate-950/50',
          autobot: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-50',
          customer: 'border-sky-500/40 bg-sky-500/10 text-sky-50',
          staff: 'border-slate-700/70 bg-slate-900/70 text-slate-100',
          internal: 'border-amber-500/40 bg-amber-500/10 text-amber-50',
          meta: 'text-slate-400',
          body: 'text-slate-200',
          empty: 'border-slate-700/70 bg-slate-900/60 text-slate-400',
        };

  function bubbleTone(message: SupportThreadMessage) {
    if (message.isInternal) {
      return palette.internal;
    }
    if (message.actorType === 'AUTOBOT') {
      return palette.autobot;
    }
    if (message.actorType === 'CUSTOMER') {
      return palette.customer;
    }
    return palette.staff;
  }

  return (
    <div className={`rounded-[28px] border p-4 ${palette.thread}`}>
      <div className="space-y-3">
        {!messages.length ? (
          <div
            className={`rounded-[22px] border border-dashed px-4 py-5 text-sm ${palette.empty}`}
          >
            No conversation has been recorded yet.
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={[
              'rounded-[24px] border px-4 py-4 shadow-[0_10px_32px_rgba(15,23,42,0.04)]',
              bubbleTone(message),
            ].join(' ')}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{resolveActorLabel(message)}</span>
                {message.author?.role ? (
                  <span className={`text-xs ${palette.meta}`}>
                    {formatStatus(message.author.role)}
                  </span>
                ) : null}
              </div>
              <span className={`text-xs ${palette.meta}`}>
                {formatDateTime(message.createdAt)}
              </span>
            </div>
            <p className={`mt-3 text-sm leading-6 whitespace-pre-wrap ${palette.body}`}>
              {message.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
