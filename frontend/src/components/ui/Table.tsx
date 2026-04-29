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
};

export function Table<T>({ rows, columns, emptyMessage = 'No records found.' }: TableProps<T>) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-700/40 bg-slate-950/55 shadow-2xl backdrop-blur">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 font-medium">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-400" colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="align-top text-slate-100">
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
