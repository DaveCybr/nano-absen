import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Plus, X, CheckCircle, Clock, XCircle, CalendarDays } from "lucide-react";
import type { LeaveBalance, LeaveCategory, LeaveRequest } from "../../types";

type Tab = "balance" | "history";

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:  { label: "Menunggu",  cls: "bg-yellow-50 text-yellow-700", icon: <Clock size={11} /> },
  approved: { label: "Disetujui", cls: "bg-green-50 text-green-700",  icon: <CheckCircle size={11} /> },
  rejected: { label: "Ditolak",  cls: "bg-red-50 text-red-700",      icon: <XCircle size={11} /> },
  cancelled:{ label: "Dibatal",  cls: "bg-gray-100 text-gray-500",   icon: <X size={11} /> },
};

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.floor((e - s) / 86400000) + 1);
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function EmployeeLeave() {
  const { employee } = useAuth();
  const currentYear = new Date().getFullYear();

  const [tab, setTab] = useState<Tab>("balance");
  const [balances, setBalances] = useState<(LeaveBalance & { leave_category: LeaveCategory })[]>([]);
  const [requests, setRequests] = useState<(LeaveRequest & { leave_category: LeaveCategory })[]>([]);
  const [categories, setCategories] = useState<LeaveCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const totalDays = formStartDate && formEndDate ? daysBetween(formStartDate, formEndDate) : 0;

  const fetchData = useCallback(async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const [balRes, reqRes, catRes] = await Promise.all([
        supabase
          .from("leave_balances")
          .select("*, leave_category:leave_categories(*)")
          .eq("employee_id", employee.id)
          .eq("year", currentYear),
        supabase
          .from("leave_requests")
          .select("*, leave_category:leave_categories(*)")
          .eq("employee_id", employee.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("leave_categories")
          .select("*")
          .order("leave_name"),
      ]);
      setBalances((balRes.data || []) as any);
      setRequests((reqRes.data || []) as any);
      setCategories((catRes.data || []) as LeaveCategory[]);
    } finally {
      setLoading(false);
    }
  }, [employee, currentYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = () => {
    setFormCategoryId(categories[0]?.id ?? "");
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormEndDate(new Date().toISOString().split("T")[0]);
    setFormReason("");
    setFormError("");
    setSubmitSuccess(false);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCategoryId) { setFormError("Pilih jenis cuti."); return; }
    if (!formStartDate || !formEndDate) { setFormError("Tanggal wajib diisi."); return; }
    if (formEndDate < formStartDate) { setFormError("Tanggal akhir tidak boleh sebelum tanggal mulai."); return; }
    setFormError("");
    setSubmitting(true);
    try {
      const { error } = await supabase.from("leave_requests").insert({
        employee_id: employee!.id,
        leave_category_id: formCategoryId,
        start_date: formStartDate,
        end_date: formEndDate,
        total_days: totalDays,
        reason: formReason.trim() || null,
        status: "pending",
      });
      if (error) throw error;
      setSubmitSuccess(true);
      await fetchData();
      setTimeout(() => setShowModal(false), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengajukan cuti.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-xl font-bold text-gray-900">Cuti</h1>
        <button onClick={openModal} className="btn-primary">
          <Plus size={15} /> Ajukan Cuti
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([["balance", "Saldo"], ["history", "Riwayat"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Balance tab */}
      {tab === "balance" && (
        <div className="space-y-2">
          {balances.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <CalendarDays size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Belum ada saldo cuti untuk tahun {currentYear}.</p>
              <p className="text-xs text-gray-400 mt-1">Hubungi HR untuk generate saldo cuti.</p>
            </div>
          ) : (
            balances.map((b) => {
              const taken = b.annual_taken + b.other_taken;
              const limit = b.leave_category?.limit_per_year ?? null;
              const remaining = limit !== null ? Math.max(0, limit - taken) : null;
              const pct = limit ? Math.min(100, (taken / limit) * 100) : 0;
              return (
                <div key={b.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-800">{b.leave_category?.leave_name}</p>
                    <span className="text-xs text-gray-400">{currentYear}</span>
                  </div>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <span className="text-2xl font-bold text-blue-600">{remaining ?? "∞"}</span>
                      <span className="text-xs text-gray-400 ml-1">hari tersisa</span>
                    </div>
                    {limit !== null && (
                      <p className="text-xs text-gray-400">{taken} / {limit} terpakai</p>
                    )}
                  </div>
                  {limit !== null && (
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className="space-y-2">
          {requests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <CalendarDays size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Belum ada pengajuan cuti.</p>
            </div>
          ) : (
            requests.map((r) => {
              const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
              return (
                <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {r.leave_category?.leave_name ?? "Cuti"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {fmtDate(r.start_date)}
                        {r.start_date !== r.end_date ? ` – ${fmtDate(r.end_date)}` : ""}
                        {" · "}
                        <span className="font-medium">{r.total_days} hari</span>
                      </p>
                      {r.reason && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{r.reason}</p>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${cfg.cls}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
            {submitSuccess ? (
              <div className="p-8 flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center">
                  <CheckCircle size={28} className="text-green-500" />
                </div>
                <p className="font-semibold text-gray-900">Pengajuan Berhasil!</p>
                <p className="text-sm text-gray-500">Cuti kamu sudah diajukan dan menunggu persetujuan HR.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">Ajukan Cuti</h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                  <div>
                    <label className="form-label">Jenis Cuti</label>
                    <select
                      className="select w-full"
                      value={formCategoryId}
                      onChange={(e) => setFormCategoryId(e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.leave_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Tanggal Mulai</label>
                      <input
                        type="date"
                        className="form-input w-full"
                        value={formStartDate}
                        onChange={(e) => {
                          setFormStartDate(e.target.value);
                          if (formEndDate < e.target.value) setFormEndDate(e.target.value);
                        }}
                      />
                    </div>
                    <div>
                      <label className="form-label">Tanggal Akhir</label>
                      <input
                        type="date"
                        className="form-input w-full"
                        min={formStartDate}
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {totalDays > 0 && (
                    <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-700 font-medium">
                      Total: {totalDays} hari
                    </div>
                  )}

                  <div>
                    <label className="form-label">Alasan <span className="text-gray-400 font-normal">(opsional)</span></label>
                    <textarea
                      className="form-input w-full resize-none"
                      rows={3}
                      placeholder="Tulis alasan pengajuan cuti..."
                      value={formReason}
                      onChange={(e) => setFormReason(e.target.value)}
                    />
                  </div>

                  {formError && (
                    <div className="p-3 bg-red-50 rounded-lg text-xs text-red-700">{formError}</div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="btn-secondary justify-center"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary justify-center"
                    >
                      {submitting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        "Ajukan"
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
