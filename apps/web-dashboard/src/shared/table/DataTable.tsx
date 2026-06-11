import type { InputHTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import { cn } from "../lib/cn";
import { EmptyState } from "../ui/EmptyState";
import { TableSkeleton } from "../ui/LoadingSkeleton";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
};

export function DataTable<T extends { id?: string }>({
  rows,
  columns,
  loading,
  emptyTitle = "No rows found",
  emptyDescription,
  emptyAction,
  onRowClick,
  getRowLabel,
  actions
}: {
  rows: T[];
  columns: Array<DataTableColumn<T>>;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  getRowLabel?: (row: T) => string;
  actions?: (row: T) => ReactNode;
}) {
  if (loading) return <TableSkeleton />;
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 border-b border-line bg-panel text-xs uppercase text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn("whitespace-nowrap px-4 py-3 font-semibold", column.headerClassName)}>
                <span className="inline-flex items-center gap-1.5">
                  {column.header}
                  {column.sortable ? <ArrowUpDown className="h-3 w-3 text-slate-600" aria-hidden="true" /> : null}
                </span>
              </th>
            ))}
            {actions ? (
              <th className="w-10 px-4 py-3 text-right font-semibold">
                <MoreHorizontal className="ml-auto h-4 w-4 text-slate-600" aria-hidden="true" />
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {rows.map((row, index) => (
            <tr
              key={row.id ?? index}
              className={cn("transition hover:bg-panel-hover", onRowClick && "cursor-pointer focus-visible:bg-panel-hover focus-visible:outline-none")}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={(event) => handleRowKeyDown(event, row)}
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={onRowClick ? getRowLabel?.(row) ?? "Open row details" : undefined}
            >
              {columns.map((column) => <td key={column.key} className={cn("px-4 py-3 text-slate-300", column.className)}>{column.render(row)}</td>)}
              {actions ? <td className="px-4 py-3 text-right">{actions(row)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableToolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-3">{children}</div>;
}

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 min-w-64 rounded-full border border-line bg-panel-soft px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-mint focus:ring-2 focus:ring-mint/20",
        className
      )}
      type="search"
      {...props}
    />
  );
}

export const FilterBar = TableToolbar;
