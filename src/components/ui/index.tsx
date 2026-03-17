import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from "lucide-react";
import clsx from "clsx";

// ─── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={clsx("animate-spin text-blue-600", className)}
      size={18}
    />
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
export function EmptyState({
  message = "Tidak ada data",
}: {
  message?: string;
}) {
  return (
    <tr>
      <td colSpan={99} className="text-center py-16 text-gray-400 text-sm">
        {message}
      </td>
    </tr>
  );
}

// ─── Status Badge Attendance ─────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-300">-</span>;
  const map: Record<string, string> = {
    on_time: "badge-green",
    in_tolerance: "badge-yellow",
    late: "badge-red",
    early_check_out: "badge-orange",
    others: "badge-gray",
    checked_out: "badge-blue",
  };
  const label: Record<string, string> = {
    on_time: "On-Time",
    in_tolerance: "In Tolerance",
    late: "Late",
    early_check_out: "Early Check-Out",
    others: "others",
    checked_out: "Checked-Out",
  };
  return (
    <span className={clsx("badge", map[status] || "badge-gray")}>
      {label[status] || status}
    </span>
  );
}

// ─── Location Badge ───────────────────────────────────────────────────────────
export function LocationBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-300">-</span>;
  const map: Record<string, string> = {
    in_area: "badge-green",
    out_of_area: "badge-red",
    meeting: "badge-yellow",
    tolerance: "badge-blue",
    correction: "badge-purple",
  };
  const label: Record<string, string> = {
    in_area: "In-Area",
    out_of_area: "Out Zone",
    meeting: "Meeting",
    tolerance: "Tolerance",
    correction: "Correction",
  };
  return (
    <span className={clsx("badge", map[status] || "badge-gray")}>
      {label[status] || status}
    </span>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
}
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Items per page:</span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSize(Number(e.target.value));
            onPage(1);
          }}
          className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[10, 25, 50].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">
          {from}–{to} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(1)}
            disabled={page === 1}
            className="btn-icon disabled:opacity-30"
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            onClick={() => onPage(page - 1)}
            disabled={page === 1}
            className="btn-icon disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages}
            className="btn-icon disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => onPage(totalPages)}
            disabled={page >= totalPages}
            className="btn-icon disabled:opacity-30"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}
export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-2xl",
}: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={clsx("bg-white rounded-2xl shadow-xl w-full", width)}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="btn-icon text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Format helpers ───────────────────────────────────────────────────────────
export function formatTime(ts: string | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("id-ID", {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatMinutes(mins: number): string {
  if (!mins) return "-";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
