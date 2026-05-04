type TimelineStop = {
  sequence?: number;
  address?: string;
  contactName?: string;
  contactPhone?: string;
};

export function TrackingTimeline({ stops = [] as TimelineStop[] }) {
  return (
    <section className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
      <p className="text-[11px] uppercase tracking-[0.28em] text-sky-700">Route timeline</p>
      <h3 className="mt-1 text-2xl font-semibold text-slate-950">Stop-by-stop view</h3>

      <div className="mt-5 space-y-4">
        {stops.length === 0 ? (
          <p className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            No route stops are available yet.
          </p>
        ) : (
          stops.map((stop, index) => {
            const isPickup = index === 0;
            const chipClassName = isPickup
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700';
            const label = isPickup ? 'Pickup' : 'Drop-off';

            return (
              <div key={`${stop.sequence ?? index}-${stop.address}`} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`mt-1 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${chipClassName}`}
                  >
                    {stop.sequence ?? index + 1}
                  </div>
                  {index < stops.length - 1 ? <div className="mt-2 h-16 w-px bg-slate-300" /> : null}
                </div>

                <div className="min-w-0 flex-1 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {stop.address ?? 'Address pending'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {stop.contactName ?? 'Contact pending'}
                    {stop.contactPhone ? ` · ${stop.contactPhone}` : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
