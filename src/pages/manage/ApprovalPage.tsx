import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import {
  Spinner,
  EmptyState,
  Pagination,
  Modal,
  formatTime,
} from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import clsx from "clsx";

type ApprovalTab = "leave" | "overtime" | "correction";

interface LeaveRequestRow {
  id: string;
  employee: {
    full_name: string;
    employee_code: string;
    group: { name: string } | null;
  };
  leave_category: { leave_name: string; leave_type: string };
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  created_at: string;
}

interface OvertimeRow {
  id: string;
  employee: {
    full_name: string;
    employee_code: string;
    group: { name: string } | null;
  };
  overtime_category: { name_id: string; code: string };
  overtime_date: string;
  start_time: string;
  end_time: string;
  total_minutes: number;
  reason: string | null;
  status: string;
  created_at: string;
}

interface CorrectionRow {
  id: string;
  employee: {
    full_name: string;
    employee_code: string;
    group: { name: string } | null;
  };
  attendance: {
    attendance_date: string;
    time_in: string | null;
    time_out: string | null;
  };
  correction_type: string;
  reason: string;
  requested_time_in: string | null;
  requested_time_out: string | null;
  admin_notes: string | null;
  status: string;
  created_at: string;
}

export default function ApprovalPage() {
  const { employee: currentEmployee } = useAuth();
  const [tab, setTab] = useState<ApprovalTab>("leave");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Leave
  const [leaveRows, setLeaveRows] = useState<LeaveRequestRow[]>([]);
  const [leaveTotal, setLeaveTotal] = useState(0);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveDetail, setLeaveDetail] = useState<LeaveRequestRow | null>(null);

  // Overtime
  const [otRows, setOtRows] = useState<OvertimeRow[]>([]);
  const [otTotal, setOtTotal] = useState(0);
  const [otLoading, setOtLoading] = useState(false);
  const [otDetail, setOtDetail] = useState<OvertimeRow | null>(null);

  // Correction
  const [crRows, setCrRows] = useState<CorrectionRow[]>([]);
  const [crTotal, setCrTotal] = useState(0);
  const [crLoading, setCrLoading] = useState(false);
  const [crDetail, setCrDetail] = useState<CorrectionRow | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState("");

  // ── Fetch Leave ────────────────────────────────────────────────────────────
  const fetchLeave = useCallback(async () => {
    setLeaveLoading(true);
    let q = supabase
      .from("leave_requests")
      .select(
        `*, employee:employees!leave_requests_employee_id_fkey(full_name,employee_code,group:groups!left(name)), leave_category:leave_categories!left(leave_name,leave_type)`,
        { count: "exact" },
      )
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data, count, error } = await q.range(
      (page - 1) * pageSize,
      page * pageSize - 1,
    );
    if (error) console.error('fetchLeave error:', error);
    setLeaveRows((data || []) as LeaveRequestRow[]);
    setLeaveTotal(count || 0);
    setLeaveLoading(false);
  }, [statusFilter, page, pageSize]);

  // ── Fetch Overtime ─────────────────────────────────────────────────────────
  const fetchOvertime = useCallback(async () => {
    setOtLoading(true);
    let q = supabase
      .from("overtime_requests")
      .select(
        `*, employee:employees!overtime_requests_employee_id_fkey(full_name,employee_code,group:groups!left(name)), overtime_category:overtime_categories!left(name_id,code)`,
        { count: "exact" },
      )
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data, count } = await q.range(
      (page - 1) * pageSize,
      page * pageSize - 1,
    );
    setOtRows((data || []) as OvertimeRow[]);
    setOtTotal(count || 0);
    setOtLoading(false);
  }, [statusFilter, page, pageSize]);

  // ── Fetch Correction ───────────────────────────────────────────────────────
  const fetchCorrection = useCallback(async () => {
    setCrLoading(true);
    let q = supabase
      .from("attendance_corrections")
      .select(
        `*, employee:employees!attendance_corrections_employee_id_fkey(full_name,employee_code,group:groups!left(name)), attendance:attendances!left(attendance_date,time_in,time_out)`,
        { count: "exact" },
      )
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data, count } = await q.range(
      (page - 1) * pageSize,
      page * pageSize - 1,
    );
    setCrRows((data || []) as CorrectionRow[]);
    setCrTotal(count || 0);
    setCrLoading(false);
  }, [statusFilter, page, pageSize]);

  useEffect(() => {
    if (tab === "leave") fetchLeave();
    if (tab === "overtime") fetchOvertime();
    if (tab === "correction") fetchCorrection();
  }, [tab, fetchLeave, fetchOvertime, fetchCorrection]);

  // ── Approve/Reject helpers ─────────────────────────────────────────────────
  const approveReject = async (
    table: string,
    id: string,
    newStatus: "approved" | "rejected",
    extra: Record<string, any> = {},
  ) => {
    setProcessing(true);
    setActionError("");
    const { error } = await supabase
      .from(table)
      .update({
        status: newStatus,
        approved_by: currentEmployee?.id,
        approved_at: new Date().toISOString(),
        ...extra,
      })
      .eq("id", id);
    if (error) {
      setActionError(error.message);
      setProcessing(false);
      return false;
    }
    setProcessing(false);
    return true;
  };

  const handleLeaveApprove = async (id: string) => {
    if (await approveReject("leave_requests", id, "approved")) {
      setLeaveDetail(null);
      fetchLeave();
    }
  };
  const handleLeaveReject = async (id: string) => {
    if (await approveReject("leave_requests", id, "rejected")) {
      setLeaveDetail(null);
      fetchLeave();
    }
  };

  const handleOtApprove = async (id: string) => {
    if (await approveReject("overtime_requests", id, "approved")) {
      setOtDetail(null);
      fetchOvertime();
    }
  };
  const handleOtReject = async (id: string) => {
    if (await approveReject("overtime_requests", id, "rejected")) {
      setOtDetail(null);
      fetchOvertime();
    }
  };

  const handleCrApprove = async (id: string) => {
    if (
      await approveReject("attendance_corrections", id, "approved", {
        admin_notes: adminNotes || null,
      })
    ) {
      setCrDetail(null);
      fetchCorrection();
    }
  };
  const handleCrReject = async (id: string) => {
    if (
      await approveReject("attendance_corrections", id, "rejected", {
        admin_notes: adminNotes || null,
      })
    ) {
      setCrDetail(null);
      fetchCorrection();
    }
  };

  // ── Shared helpers ─────────────────────────────────────────────────────────
  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "badge-yellow",
      approved: "badge-green",
      rejected: "badge-red",
      cancelled: "badge-gray",
    };
    const label: Record<string, string> = {
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      cancelled: "Cancelled",
    };
    return (
      <span className={clsx("badge", map[status] || "badge-gray")}>
        {label[status] || status}
      </span>
    );
  };

  const fmtMins = (m: number) => {
    if (!m) return "-";
    const h = Math.floor(m / 60),
      min = m % 60;
    return h > 0 ? `${h}j ${min}m` : `${min}m`;
  };

  const correctionTypeLabel: Record<string, string> = {
    time_in: "Koreksi Jam Masuk",
    time_out: "Koreksi Jam Keluar",
    both: "Koreksi Jam Masuk & Keluar",
  };

  // const total = tab === 'leave' ? leaveTotal : tab === 'overtime' ? otTotal : crTotal
  // const loading = tab === 'leave' ? leaveLoading : tab === 'overtime' ? otLoading : crLoading

  return (
    <div>
      <h1 className="page-title mb-6">Approval</h1>

      <div className="card">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 gap-1">
          {[
            { id: "leave" as ApprovalTab, label: "Leave Request" },
            { id: "overtime" as ApprovalTab, label: "Overtime Request" },
            { id: "correction" as ApprovalTab, label: "Attendance Correction" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-50">
          <div>
            <label className="form-label">Status</label>
            <select
              className="form-input w-36"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Semua</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* ── Leave tab ── */}
        {tab === "leave" && (
          <>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Leave Type</th>
                    <th>Period</th>
                    <th>Total Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16">
                        <Spinner className="mx-auto" />
                      </td>
                    </tr>
                  ) : leaveRows.length === 0 ? (
                    <EmptyState message="Tidak ada pengajuan cuti" />
                  ) : (
                    leaveRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/60">
                        <td>
                          <p className="font-medium text-gray-900">
                            {row.employee?.full_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {row.employee?.group?.name || "-"}
                          </p>
                        </td>
                        <td>
                          <span
                            className={clsx(
                              "badge",
                              row.leave_category?.leave_type === "sick"
                                ? "badge-yellow"
                                : "badge-blue",
                            )}
                          >
                            {row.leave_category?.leave_name}
                          </span>
                        </td>
                        <td className="text-sm text-gray-600">
                          {row.start_date} s/d {row.end_date}
                        </td>
                        <td className="text-center font-medium">
                          {row.total_days} hari
                        </td>
                        <td className="text-gray-600 text-sm max-w-xs truncate">
                          {row.reason || "-"}
                        </td>
                        <td>{statusBadge(row.status)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            {row.status === "pending" && (
                              <>
                                <button
                                  onClick={() => handleLeaveApprove(row.id)}
                                  className="btn-icon text-green-500"
                                  title="Approve"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  onClick={() => handleLeaveReject(row.id)}
                                  className="btn-icon text-red-400"
                                  title="Reject"
                                >
                                  <XCircle size={16} />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                setLeaveDetail(row);
                                setActionError("");
                              }}
                              className="btn-icon text-blue-500"
                              title="Detail"
                            >
                              <Clock size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={leaveTotal}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </>
        )}

        {/* ── Overtime tab ── */}
        {tab === "overtime" && (
          <>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Duration</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {otLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16">
                        <Spinner className="mx-auto" />
                      </td>
                    </tr>
                  ) : otRows.length === 0 ? (
                    <EmptyState message="Tidak ada pengajuan lembur" />
                  ) : (
                    otRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/60">
                        <td>
                          <p className="font-medium text-gray-900">
                            {row.employee?.full_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {row.employee?.group?.name || "-"}
                          </p>
                        </td>
                        <td>
                          <span className="badge badge-purple">
                            {row.overtime_category?.code} —{" "}
                            {row.overtime_category?.name_id}
                          </span>
                        </td>
                        <td className="text-sm text-gray-600 font-mono">
                          {row.overtime_date}
                        </td>
                        <td className="text-sm font-mono text-gray-700">
                          {row.start_time?.slice(0, 5)} –{" "}
                          {row.end_time?.slice(0, 5)}
                        </td>
                        <td className="text-center font-medium text-orange-600">
                          {fmtMins(row.total_minutes)}
                        </td>
                        <td className="text-gray-600 text-sm max-w-xs truncate">
                          {row.reason || "-"}
                        </td>
                        <td>{statusBadge(row.status)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            {row.status === "pending" && (
                              <>
                                <button
                                  onClick={() => handleOtApprove(row.id)}
                                  className="btn-icon text-green-500"
                                  title="Approve"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  onClick={() => handleOtReject(row.id)}
                                  className="btn-icon text-red-400"
                                  title="Reject"
                                >
                                  <XCircle size={16} />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                setOtDetail(row);
                                setActionError("");
                              }}
                              className="btn-icon text-blue-500"
                              title="Detail"
                            >
                              <Clock size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={otTotal}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </>
        )}

        {/* ── Correction tab ── */}
        {tab === "correction" && (
          <>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Attendance Date</th>
                    <th>Correction Type</th>
                    <th>Original</th>
                    <th>Requested</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {crLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16">
                        <Spinner className="mx-auto" />
                      </td>
                    </tr>
                  ) : crRows.length === 0 ? (
                    <EmptyState message="Tidak ada pengajuan koreksi" />
                  ) : (
                    crRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/60">
                        <td>
                          <p className="font-medium text-gray-900">
                            {row.employee?.full_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {row.employee?.group?.name || "-"}
                          </p>
                        </td>
                        <td className="font-mono text-sm text-gray-600">
                          {row.attendance?.attendance_date}
                        </td>
                        <td>
                          <span className="badge badge-blue">
                            {correctionTypeLabel[row.correction_type] ||
                              row.correction_type}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-gray-500">
                          <div>
                            {formatTime(row.attendance?.time_in)} –{" "}
                            {formatTime(row.attendance?.time_out)}
                          </div>
                        </td>
                        <td className="font-mono text-xs text-blue-700 font-medium">
                          <div>
                            {row.requested_time_in
                              ? formatTime(row.requested_time_in)
                              : "—"}{" "}
                            –{" "}
                            {row.requested_time_out
                              ? formatTime(row.requested_time_out)
                              : "—"}
                          </div>
                        </td>
                        <td className="text-gray-600 text-sm max-w-xs truncate">
                          {row.reason}
                        </td>
                        <td>{statusBadge(row.status)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            {row.status === "pending" && (
                              <>
                                <button
                                  onClick={() => handleCrApprove(row.id)}
                                  className="btn-icon text-green-500"
                                  title="Approve"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  onClick={() => handleCrReject(row.id)}
                                  className="btn-icon text-red-400"
                                  title="Reject"
                                >
                                  <XCircle size={16} />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                setCrDetail(row);
                                setAdminNotes(row.admin_notes || "");
                                setActionError("");
                              }}
                              className="btn-icon text-blue-500"
                              title="Detail"
                            >
                              <Clock size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={crTotal}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </>
        )}
      </div>

      {/* ── Leave Detail Modal ── */}
      <Modal
        open={!!leaveDetail}
        onClose={() => {
          setLeaveDetail(null);
          setActionError("");
        }}
        title="Detail Pengajuan Cuti"
        width="max-w-md"
      >
        {leaveDetail && (
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {actionError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: "Karyawan", value: leaveDetail.employee?.full_name },
                {
                  label: "Divisi",
                  value: leaveDetail.employee?.group?.name || "-",
                },
                {
                  label: "Jenis Cuti",
                  value: leaveDetail.leave_category?.leave_name,
                },
                { label: "Mulai", value: leaveDetail.start_date },
                { label: "Selesai", value: leaveDetail.end_date },
                {
                  label: "Total Hari",
                  value: `${leaveDetail.total_days} hari`,
                },
                { label: "Alasan", value: leaveDetail.reason || "-" },
                { label: "Status", value: statusBadge(leaveDetail.status) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <div className="font-medium text-gray-900">{value}</div>
                </div>
              ))}
            </div>
            {leaveDetail.status === "pending" && (
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleLeaveReject(leaveDetail.id)}
                  disabled={processing}
                  className="btn-danger flex-1 justify-center"
                >
                  <XCircle size={14} /> Tolak
                </button>
                <button
                  onClick={() => handleLeaveApprove(leaveDetail.id)}
                  disabled={processing}
                  className="btn-primary flex-1 justify-center bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle size={14} /> Setujui
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Overtime Detail Modal ── */}
      <Modal
        open={!!otDetail}
        onClose={() => {
          setOtDetail(null);
          setActionError("");
        }}
        title="Detail Pengajuan Lembur"
        width="max-w-md"
      >
        {otDetail && (
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {actionError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: "Karyawan", value: otDetail.employee?.full_name },
                {
                  label: "Divisi",
                  value: otDetail.employee?.group?.name || "-",
                },
                {
                  label: "Kategori",
                  value: `${otDetail.overtime_category?.code} — ${otDetail.overtime_category?.name_id}`,
                },
                { label: "Tanggal", value: otDetail.overtime_date },
                { label: "Jam Mulai", value: otDetail.start_time?.slice(0, 5) },
                { label: "Jam Selesai", value: otDetail.end_time?.slice(0, 5) },
                { label: "Durasi", value: fmtMins(otDetail.total_minutes) },
                { label: "Alasan", value: otDetail.reason || "-" },
                { label: "Status", value: statusBadge(otDetail.status) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <div className="font-medium text-gray-900">{value}</div>
                </div>
              ))}
            </div>
            {otDetail.status === "pending" && (
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleOtReject(otDetail.id)}
                  disabled={processing}
                  className="btn-danger flex-1 justify-center"
                >
                  <XCircle size={14} /> Tolak
                </button>
                <button
                  onClick={() => handleOtApprove(otDetail.id)}
                  disabled={processing}
                  className="btn-primary flex-1 justify-center bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle size={14} /> Setujui
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Correction Detail Modal ── */}
      <Modal
        open={!!crDetail}
        onClose={() => {
          setCrDetail(null);
          setActionError("");
        }}
        title="Detail Koreksi Absensi"
        width="max-w-md"
      >
        {crDetail && (
          <div className="space-y-4">
            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {actionError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: "Karyawan", value: crDetail.employee?.full_name },
                {
                  label: "Divisi",
                  value: crDetail.employee?.group?.name || "-",
                },
                {
                  label: "Tgl Absensi",
                  value: crDetail.attendance?.attendance_date,
                },
                {
                  label: "Tipe Koreksi",
                  value:
                    correctionTypeLabel[crDetail.correction_type] ||
                    crDetail.correction_type,
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <div className="font-medium text-gray-900">{value}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-1">Jam Asli</p>
                <p className="font-mono font-medium">
                  {formatTime(crDetail.attendance?.time_in) || "--:--"}
                </p>
                <p className="font-mono font-medium">
                  {formatTime(crDetail.attendance?.time_out) || "--:--"}
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-500 mb-1">Jam Diajukan</p>
                <p className="font-mono font-medium text-blue-700">
                  {crDetail.requested_time_in
                    ? formatTime(crDetail.requested_time_in)
                    : "—"}
                </p>
                <p className="font-mono font-medium text-blue-700">
                  {crDetail.requested_time_out
                    ? formatTime(crDetail.requested_time_out)
                    : "—"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Alasan</p>
              <p className="text-sm text-gray-700">{crDetail.reason}</p>
            </div>
            <div>
              <label className="form-label">Catatan Admin</label>
              <textarea
                className="form-input"
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Opsional..."
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <p className="text-sm mr-auto">{statusBadge(crDetail.status)}</p>
            </div>
            {crDetail.status === "pending" && (
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleCrReject(crDetail.id)}
                  disabled={processing}
                  className="btn-danger flex-1 justify-center"
                >
                  <XCircle size={14} /> Tolak
                </button>
                <button
                  onClick={() => handleCrApprove(crDetail.id)}
                  disabled={processing}
                  className="btn-primary flex-1 justify-center bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle size={14} /> Setujui
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
