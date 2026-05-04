import type { ReactNode } from 'react';

type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
};

type TableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  emptyMessage?: string;
  tone?: 'dark' | 'light';
};

export function Table<T>({
  rows,
  columns,
  emptyMessage = 'No records found.',
  tone = 'dark',
}: TableProps<T>) {
  const toneClasses =
    tone === 'light'
      ? {
          frame: 'overflow-hidden rounded-[20px] border border-[#d7e0ec] bg-[#f8fbff] shadow-[0_8px_20px_rgba(15,23,42,0.04)]',
          head: 'bg-white text-[#64748b]',
          divide: 'divide-[#e5edf7]',
          row: 'align-top text-[#1a1a2e]',
          empty: 'text-[#64748b]',
        }
      : {
          frame: 'overflow-hidden rounded-3xl border border-slate-700/40 bg-slate-950/55 shadow-2xl backdrop-blur',
          head: 'bg-slate-900/80 text-slate-400',
          divide: 'divide-slate-800',
          row: 'align-top text-slate-100',
          empty: 'text-slate-400',
        };

  return (
    <div className={toneClasses.frame}>
      <div className="overflow-x-auto">
        <table className={`min-w-full divide-y text-left text-sm ${toneClasses.divide}`}>
          <thead className={toneClasses.head}>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 font-medium">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y ${toneClasses.divide}`}>
            {rows.length === 0 ? (
              <tr>
                <td className={`px-4 py-6 ${toneClasses.empty}`} colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className={toneClasses.row}>
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3">
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
