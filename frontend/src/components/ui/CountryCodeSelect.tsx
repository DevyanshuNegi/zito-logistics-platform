'use client';

import {
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  filterCountryCodeOptions,
  findCountryCodeOptionByIsoCode,
  type CountryCodeOption,
} from '@/lib/country-codes';

type CountryCodeSelectProps = {
  label?: string;
  value: string;
  onChange: (isoCode: string) => void;
  help?: string;
  error?: string;
  disabled?: boolean;
  compact?: boolean;
  tone?: 'dark' | 'light';
};

export function CountryCodeSelect({
  label = 'Country code',
  value,
  onChange,
  help,
  error,
  disabled = false,
  compact = false,
  tone = 'dark',
}: CountryCodeSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selectedOption = findCountryCodeOptionByIsoCode(value);
  const filteredOptions = filterCountryCodeOptions(deferredQuery);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  function selectOption(option: CountryCodeOption) {
    onChange(option.isoCode);
    setOpen(false);
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  }

  const triggerClassName = [
    'flex w-full items-center justify-between gap-3 rounded-2xl border text-left text-sm transition focus:outline-none',
    tone === 'light'
      ? 'border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-100'
      : 'border-slate-700/70 bg-slate-950/60 text-slate-100 focus:border-cyan-400/80 focus:ring-1 focus:ring-violet-500/40',
    compact ? 'h-[50px] px-4 py-0' : 'px-4 py-3',
    disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-slate-600/80',
  ].join(' ');

  return (
    <div ref={containerRef} className="relative">
      <label className="block space-y-2">
        <span className={tone === 'light' ? 'text-sm font-medium text-slate-700' : 'text-sm font-medium text-slate-200'}>
          {label}
        </span>
        <button
          type="button"
          className={triggerClassName}
          aria-controls={listId}
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={handleTriggerKeyDown}
        >
          {compact ? (
            <span
              className={[
                'min-w-0 truncate font-semibold',
                tone === 'light' ? 'text-slate-900' : 'text-slate-50',
              ].join(' ')}
            >
              {selectedOption ? selectedOption.dialCode : 'Code'}
            </span>
          ) : (
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {selectedOption ? selectedOption.dialCode : 'Select a country code'}
              </span>
              <span className="block truncate text-xs text-slate-400">
                {selectedOption
                  ? `${selectedOption.name} (${selectedOption.isoCode})`
                  : 'Search by country, ISO code, or dial code'}
              </span>
            </span>
          )}
          <span
            aria-hidden="true"
            className={[
              'shrink-0 transition',
              tone === 'light' ? 'text-slate-500' : 'text-slate-500',
              open ? 'rotate-180' : '',
            ].join(' ')}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 6.5L8 10L12 6.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
        {error ? (
          <span className={tone === 'light' ? 'text-xs text-rose-600' : 'text-xs text-rose-300'}>
            {error}
          </span>
        ) : null}
        {!error && help ? (
          <span className={tone === 'light' ? 'text-xs text-slate-500' : 'text-xs text-slate-400'}>
            {help}
          </span>
        ) : null}
      </label>

      {open ? (
        <div
          id={listId}
          className={[
            'absolute z-30 mt-2 w-full overflow-hidden rounded-3xl border shadow-2xl backdrop-blur',
            tone === 'light'
              ? 'border-slate-200 bg-white shadow-slate-200/70'
              : 'border-slate-700/80 bg-slate-950/95 shadow-slate-950/60',
          ].join(' ')}
        >
          <div className={['border-b p-3', tone === 'light' ? 'border-slate-200' : 'border-slate-800/90'].join(' ')}>
            <input
              ref={searchInputRef}
              className={[
                'w-full rounded-2xl border px-4 py-3 text-sm focus:outline-none',
                tone === 'light'
                  ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100'
                  : 'border-slate-700/70 bg-slate-900/90 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/80 focus:ring-1 focus:ring-violet-500/40',
              ].join(' ')}
              placeholder="Search country, ISO, or dial code"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = option.isoCode === selectedOption?.isoCode;
                return (
                  <button
                    key={option.isoCode}
                    type="button"
                    className={[
                      'flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition',
                      isSelected
                        ? 'bg-cyan-500/12 text-cyan-100'
                        : tone === 'light'
                          ? 'text-slate-800 hover:bg-slate-100'
                          : 'text-slate-200 hover:bg-slate-900/90',
                    ].join(' ')}
                    onClick={() => selectOption(option)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{option.name}</span>
                      <span
                        className={
                          tone === 'light'
                            ? 'block truncate text-xs text-slate-500'
                            : 'block truncate text-xs text-slate-400'
                        }
                      >
                        {option.isoCode}
                      </span>
                    </span>
                    <span
                      className={
                        tone === 'light'
                          ? 'shrink-0 text-sm font-semibold text-slate-700'
                          : 'shrink-0 text-sm font-semibold text-slate-200'
                      }
                    >
                      {option.dialCode}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className={tone === 'light' ? 'px-3 py-4 text-sm text-slate-500' : 'px-3 py-4 text-sm text-slate-400'}>
                No countries matched that search.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
