type TimelineStop = {
  sequence?: number;
  address?: string;
  contactName?: string;
  contactPhone?: string;
};

export function TrackingTimeline({ stops = [] as TimelineStop[] }) {
  return (
    <section className="rounded-3xl border border-slate-700/40 bg-slate-950/55 p-5 shadow-2xl backdrop-blur">
      <h3 className="text-lg font-semibold text-white">Route Timeline</h3>
      <div className="mt-4 space-y-4">
        {stops.length === 0 ? (
          <p className="text-sm text-slate-400">No route stops available yet.</p>
        ) : (
          stops.map((stop, index) => (
            <div key={`${stop.sequence ?? index}-${stop.address}`} className="flex gap-4">
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-sky-200">
                {stop.sequence ?? index + 1}
              </div>
              <div>
                <p className="font-medium text-slate-100">{stop.address ?? 'Address pending'}</p>
                <p className="text-sm text-slate-400">
                  {stop.contactName ?? 'Contact pending'}
                  {stop.contactPhone ? ` · ${stop.contactPhone}` : ''}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
