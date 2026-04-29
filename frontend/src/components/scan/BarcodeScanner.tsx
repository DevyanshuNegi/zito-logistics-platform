'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type BarcodeScannerProps = {
  onDetected: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function BarcodeScanner({
  onDetected,
  label = 'Scan parcel barcode',
  placeholder = 'Scan or paste parcel barcode / item id',
  disabled = false,
}: BarcodeScannerProps) {
  const [draft, setDraft] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) {
      return;
    }

    onDetected(value);
    setDraft('');
  }

  return (
    <div className="rounded-3xl border border-sky-500/20 bg-sky-500/10 p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-sky-200/70">
            Scanner
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">{label}</h3>
        </div>
        <div className="rounded-2xl border border-sky-400/20 bg-slate-950/40 px-4 py-2 text-xs text-sky-100">
          Manual scanner fallback
        </div>
      </div>

      <div className="mb-5 grid grid-cols-12 gap-1 rounded-2xl border border-slate-700/40 bg-slate-950/50 p-4">
        {Array.from({ length: 48 }).map((_, index) => (
          <div
            key={index}
            className={`h-10 rounded-sm ${
              index % 5 === 0 || index % 7 === 0
                ? 'bg-slate-100'
                : 'bg-slate-700'
            }`}
          />
        ))}
      </div>

      <form className="flex flex-col gap-3 md:flex-row" onSubmit={submit}>
        <div className="flex-1">
          <Input
            label="Barcode value"
            value={draft}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="md:self-end">
          <Button disabled={disabled || !draft.trim()} type="submit">
            Use scanned code
          </Button>
        </div>
      </form>
    </div>
  );
}
