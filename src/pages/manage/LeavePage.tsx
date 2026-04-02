import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import {
  Plus,
  Edit2,
  FileText,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import { Spinner, EmptyState, Pagination, Modal } from "../../components/ui";
import { exportCsv } from "../../lib/exportCsv";
import type { LeaveCategory, LeaveBalance, Group } from "../../types";

type Tab = "balance" | "category";

interface BalanceRow extends Omit<LeaveBalance, "employee"> {
  employee: {
    id: string;
    full_name: string;
    employee_code: string;
    group: { name: string } | null;
  };
  leave_category: LeaveCategory;
}

export default function LeavePage() {
  const [tab, setTab] = useState<Tab>("balance");

  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupFilter, setGroupFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(
    String(new Date().getFullYear()),
  );
  const [loadingBal, setLoadingBal] = useState(false);
  const [pageBal, setPageBal] = useState(1);
  const [pageSizeBal, setPageSizeBal] = useState(10);
  const [totalBal, setTotalBal] = useState(0);

  // Generate balance state
  const [genModal, setGenModal] = useState(false);
  const [genYear, setGenYear] = useState(String(new Date().getFullYear()));
  const [genGroup, setGenGroup] = useState("all");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{
    created: number;
    skipped: number;
    error?: string;
  } | null>(null);

  // Edit balance modal
  const [editBal, setEditBal] = useState<BalanceRow | null>(null);
  const [editAnnual, setEditAnnual] = useState("");
  const [editOther, setEditOther] = useState("");
  const [savingBal, setSavingBal] = useState(false);
  const [editBalError, setEditBalError] = useState("");

  // Detail modal
  const [detailBal, setDetailBal] = useState<BalanceRow | null>(null);

  const [categories, setCategories] = useState<LeaveCategory[]>([]);
  const [loadingCat, setLoadingCat] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editCat, setEditCat] = useState<LeaveCategory | null>(null);
  const [deleteCat, setDeleteCat] = useState<LeaveCategory | null>(null);
  const [savingCat, setSavingCat] = useState(false);
  const [catError, setCatError] = useState("");

  const [fType, setFType] = useState("special");
  const [fName, setFName] = useState("");
  const [fLimit, setFLimit] = useState("");
  const [fAmount, setFAmount] = useState<"as_requested" | "fixed">(
    "as_requested",
  );
  const [fApproval, setFApproval] = useState("1");
  const [fMinPeriod, setFMinPeriod] = useState("0");

  const [downloading, setDownloading] = useState(false);

  // ── Resolve employee IDs from group filter ────────────────────────────────
  const resolveEmpIds = async (group: string): Promise<string[] | null> => {
    if (group === "all") return null;
    const { data } = await supabase
      .from("employees")
      .select("id")
      .eq("group_id", group)
      .eq("is_active", true);
    return (data || []).map((e) => e.id);
  };

  // ── Fetch Balances (FIX: filter group via employee IDs) ───────────────────
  const fetchBalances = useCallback(async () => {
    setLoadingBal(true);
    try {
      const empIds = await resolveEmpIds(groupFilter);

      let q = supabase
        .from("leave_balances")
        .select(
          `
          *,
          employee:employees(id,full_name,employee_code,group:groups(name)),
          leave_category:leave_categories(id,leave_name,leave_type,limit_per_year)
        `,
          { count: "exact" },
        )
        .order("employee_id");

      if (yearFilter) q = q.eq("year", parseInt(yearFilter));
      if (empIds !== null) {
        if (empIds.length === 0) {
          setBalances([]);
          setTotalBal(0);
          setLoadingBal(false);
          return;
        }
        q = q.in("employee_id", empIds);
      }

      const { data, count } = await q.range(
        (pageBal - 1) * pageSizeBal,
        pageBal * pageSizeBal - 1,
      );
      setBalances((data || []) as BalanceRow[]);
      setTotalBal(count || 0);
    } finally {
      setLoadingBal(false);
    }
  }, [groupFilter, yearFilter, pageBal, pageSizeBal]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // ── Download (FIX: filter group via employee IDs) ────────────────────────
  const handleDownloadBalance = async () => {
    setDownloading(true);
    try {
      const empIds = await resolveEmpIds(groupFilter);

      let q = supabase
        .from("leave_balances")
        .select(
          "*, employee:employees(employee_code,full_name,group:groups(name)), leave_category:leave_categories(leave_name,limit_per_year)",
        )
        .eq("year", parseInt(yearFilter))
        .order("employee_id");

      if (empIds !== null) {
        if (empIds.length === 0) return;
        q = q.in("employee_id", empIds);
      }

      const { data } = await q;

      exportCsv(
        `leave-balance_${yearFilter}`,
        [
          "Kode",
          "Nama",
          "Grup",
          "Jenis Cuti",
          "Limit/Tahun",
          "Terpakai (Tahunan)",
          "Terpakai (Lainnya)",
          "Sisa",
        ],
        (data || []).map((b: any) => {
          const limit = b.leave_category?.limit_per_year;
          const taken = (b.annual_taken ?? 0) + (b.other_taken ?? 0);
          const sisa = limit != null ? Math.max(0, limit - taken) : "∞";
          return [
            b.employee?.employee_code ?? "",
            b.employee?.full_name ?? "",
            b.employee?.group?.name ?? "",
            b.leave_category?.leave_name ?? "",
            limit ?? "∞",
            b.annual_taken ?? 0,
            b.other_taken ?? 0,
            sisa,
          ];
        }),
      );
    } finally {
      setDownloading(false);
    }
  };

  // ── Generate Balance (FIX: accurate created count) ───────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    setGenResult(null);
    try {
      let empQuery = supabase
        .from("employees")
        .select("id")
        .eq("is_active", true);
      if (genGroup !== "all") empQuery = empQuery.eq("group_id", genGroup);
      const { data: employees, error: empErr } = await empQuery;
      if (empErr) throw empErr;

      const { data: cats, error: catErr } = await supabase
        .from("leave_categories")
        .select("id");
      if (catErr) throw catErr;

      if (!employees?.length) {
        setGenResult({
          created: 0,
          skipped: 0,
          error: "Tidak ada karyawan aktif",
        });
        return;
      }
      if (!cats?.length) {
        setGenResult({
          created: 0,
          skipped: 0,
          error: "Belum ada kategori cuti",
        });
        return;
      }

      const year = parseInt(genYear);
      const empIds = employees.map((e) => e.id);
      const catIds = cats.map((c) => c.id);

      // Count existing before upsert (FIX: scope to same empIds)
      const { count: before } = await supabase
        .from("leave_balances")
        .select("id", { count: "exact", head: true })
        .eq("year", year)
        .in("employee_id", empIds);

      const records = employees.flatMap((emp) =>
        cats.map((cat) => ({
          employee_id: emp.id,
          leave_category_id: cat.id,
          year,
          annual_taken: 0,
          other_taken: 0,
        })),
      );

      const { error } = await supabase
        .from("leave_balances")
        .upsert(records, {
          onConflict: "employee_id,leave_category_id,year",
          ignoreDuplicates: true,
        });
      if (error) throw error;

      // Count after upsert (same scope)
      const { count: after } = await supabase
        .from("leave_balances")
        .select("id", { count: "exact", head: true })
        .eq("year", year)
        .in("employee_id", empIds)
        .in("leave_category_id", catIds);

      const created = Math.max(0, (after || 0) - (before || 0));
      const skipped = records.length - created;
      setGenResult({ created, skipped });
      fetchBalances();
    } catch (err: any) {
      setGenResult({ created: 0, skipped: 0, error: err.message });
    } finally {
      setGenerating(false);
    }
  };

  // ── Edit Balance ──────────────────────────────────────────────────────────
  const openEditBal = (b: BalanceRow) => {
    setEditBal(b);
    setEditAnnual(String(b.annual_taken ?? 0));
    setEditOther(String(b.other_taken ?? 0));
    setEditBalError("");
  };

  const handleSaveBal = async () => {
    if (!editBal) return;
    const annual = parseInt(editAnnual);
    const other = parseInt(editOther);
    if (isNaN(annual) || isNaN(other) || annual < 0 || other < 0) {
      setEditBalError("Nilai harus berupa angka positif");
      return;
    }
    setSavingBal(true);
    try {
      const { error } = await supabase
        .from("leave_balances")
        .update({ annual_taken: annual, other_taken: other })
        .eq("id", editBal.id);
      if (error) throw error;
      setEditBal(null);
      fetchBalances();
    } catch (err: any) {
      setEditBalError(err.message);
    } finally {
      setSavingBal(false);
    }
  };

  // ── Categories ────────────────────────────────────────────────────────────
  const fetchCategories = async () => {
    setLoadingCat(true);
    const { data } = await supabase
      .from("leave_categories")
      .select("*")
      .order("leave_name");
    setCategories((data as LeaveCategory[]) || []);
    setLoadingCat(false);
  };

  useEffect(() => {
    supabase
      .from("groups")
      .select("id,name")
      .order("name")
      .then(({ data }) => setGroups((data as Group[]) || []));
    fetchCategories();
  }, []);

  const openAddCat = () => {
    setEditCat(null);
    setFType("special");
    setFName("");
    setFLimit("");
    setFAmount("as_requested");
    setFApproval("1");
    setFMinPeriod("0");
    setCatError("");
    setCatModalOpen(true);
  };

  const openEditCat = (c: LeaveCategory) => {
    setEditCat(c);
    setFType(c.leave_type);
    setFName(c.leave_name);
    setFLimit(c.limit_per_year ? String(c.limit_per_year) : "");
    setFAmount(c.amount_per_taken);
    setFApproval(String(c.approval_level));
    setFMinPeriod("0");
    setCatError("");
    setCatModalOpen(true);
  };

  const handleSaveCat = async () => {
    if (!fName.trim()) {
      setCatError("Nama cuti wajib diisi");
      return;
    }
    setCatError("");
    setSavingCat(true);
    const payload = {
      leave_type: fType,
      leave_name: fName,
      limit_per_year: fLimit ? parseInt(fLimit) : null,
      amount_per_taken: fAmount,
      approval_level: parseInt(fApproval) || 1,
      min_working_period_days: parseInt(fMinPeriod) || 0,
    };
    try {
      if (editCat) {
        const { error } = await supabase
          .from("leave_categories")
          .update(payload)
          .eq("id", editCat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("leave_categories")
          .insert(payload);
        if (error) throw error;
      }
      setCatModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      setCatError(err.message);
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCat = async () => {
    if (!deleteCat) return;
    await supabase.from("leave_categories").delete().eq("id", deleteCat.id);
    setDeleteCat(null);
    fetchCategories();
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getSisa = (b: BalanceRow) => {
    const limit = b.leave_category?.limit_per_year;
    if (limit == null) return null;
    return Math.max(0, limit - (b.annual_taken ?? 0) - (b.other_taken ?? 0));
  };

  return (
    <div>
      <h1 className="page-title mb-6">Leave</h1>

      <div className="card">
        <div className="flex border-b border-gray-100 px-4 gap-1">
          {[
            { id: "balance" as Tab, label: "Leave Balance" },
            { id: "category" as Tab, label: "Leave Category" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
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

        {/* ── Balance Tab ── */}
        {tab === "balance" && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-3 border-b border-gray-100">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="form-label">Year</label>
                  <select
                    className="form-input w-28"
                    value={yearFilter}
                    onChange={(e) => {
                      setYearFilter(e.target.value);
                      setPageBal(1);
                    }}
                  >
                    {Array.from(
                      { length: 5 },
                      (_, i) => new Date().getFullYear() - i,
                    ).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Group</label>
                  <select
                    className="form-input w-44"
                    value={groupFilter}
                    onChange={(e) => {
                      setGroupFilter(e.target.value);
                      setPageBal(1);
                    }}
                  >
                    <option value="all">All Group</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setGenYear(String(new Date().getFullYear()));
                    setGenGroup("all");
                    setGenResult(null);
                    setGenModal(true);
                  }}
                  className="btn-secondary"
                >
                  <RefreshCw size={14} /> Generate Balance
                </button>
                <button
                  onClick={handleDownloadBalance}
                  disabled={downloading}
                  className="btn-secondary"
                >
                  {downloading ? (
                    <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  {downloading ? "Mengunduh..." : "Download"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Full Name</th>
                    <th>Group</th>
                    <th>Leave Category</th>
                    <th className="text-center">Annual Taken</th>
                    <th className="text-center">Other Taken</th>
                    <th className="text-center">Sisa</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingBal ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16">
                        <Spinner className="mx-auto" />
                      </td>
                    </tr>
                  ) : balances.length === 0 ? (
                    <EmptyState message="Belum ada data saldo cuti. Klik Generate Balance untuk membuat." />
                  ) : (
                    balances.map((b) => {
                      const sisa = getSisa(b);
                      return (
                        <tr key={b.id} className="hover:bg-gray-50/60">
                          <td className="font-mono text-xs text-gray-500">
                            {b.employee?.employee_code}
                          </td>
                          <td className="font-medium text-gray-900">
                            {b.employee?.full_name}
                          </td>
                          <td>
                            <span className="badge badge-gray">
                              {b.employee?.group?.name || "-"}
                            </span>
                          </td>
                          <td className="text-sm text-gray-700">
                            {b.leave_category?.leave_name}
                          </td>
                          <td className="text-center">
                            <span className="font-semibold text-gray-900">
                              {b.annual_taken}
                            </span>
                            <span className="text-gray-400 text-xs">
                              {" "}
                              / {b.leave_category?.limit_per_year ?? "∞"}
                            </span>
                          </td>
                          <td className="text-center font-semibold text-gray-900">
                            {b.other_taken}
                          </td>
                          <td className="text-center">
                            {sisa === null ? (
                              <span className="text-gray-400 text-xs">∞</span>
                            ) : (
                              <span
                                className={`font-semibold text-sm ${sisa === 0 ? "text-red-500" : sisa <= 3 ? "text-orange-500" : "text-green-600"}`}
                              >
                                {sisa}
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setDetailBal(b)}
                                className="btn-icon text-blue-500"
                                title="Detail"
                              >
                                <FileText size={14} />
                              </button>
                              <button
                                onClick={() => openEditBal(b)}
                                className="btn-icon text-gray-400"
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={pageBal}
              pageSize={pageSizeBal}
              total={totalBal}
              onPage={setPageBal}
              onPageSize={setPageSizeBal}
            />
          </>
        )}

        {/* ── Category Tab ── */}
        {tab === "category" && (
          <>
            <div className="flex items-center justify-end px-4 py-3 border-b border-gray-100">
              <button onClick={openAddCat} className="btn-primary">
                <Plus size={14} /> Add Leave Category
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Leave Type</th>
                    <th>Leave Name</th>
                    <th>Limit / Year</th>
                    <th>Amount per Taken</th>
                    <th>Approval Level</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCat ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16">
                        <Spinner className="mx-auto" />
                      </td>
                    </tr>
                  ) : categories.length === 0 ? (
                    <EmptyState message="Belum ada kategori cuti" />
                  ) : (
                    categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-gray-50/60">
                        <td>
                          <span
                            className={`badge ${cat.leave_type === "annual" ? "badge-green" : cat.leave_type === "sick" ? "badge-yellow" : "badge-blue"}`}
                          >
                            {cat.leave_type === "sick"
                              ? "Sick Leave"
                              : cat.leave_type === "annual"
                                ? "Annual Leave"
                                : cat.leave_type === "special"
                                  ? "Special Leave"
                                  : "Other"}
                          </span>
                        </td>
                        <td className="font-medium text-gray-900">
                          {cat.leave_name}
                        </td>
                        <td className="text-gray-600">
                          {cat.limit_per_year ? (
                            `${cat.limit_per_year} hari`
                          ) : (
                            <span className="text-gray-400">
                              Tidak terbatas
                            </span>
                          )}
                        </td>
                        <td className="text-gray-600">
                          {cat.amount_per_taken === "as_requested"
                            ? "As Requested"
                            : "Fixed"}
                        </td>
                        <td className="text-center text-gray-600">
                          {cat.approval_level}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditCat(cat)}
                              className="btn-icon text-blue-500"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteCat(cat)}
                              className="btn-icon text-red-400"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Generate Balance Modal ── */}
      <Modal
        open={genModal}
        onClose={() => setGenModal(false)}
        title="Generate Leave Balance"
        width="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Generate akan membuat saldo cuti baru untuk semua karyawan aktif ×
            semua kategori cuti pada tahun yang dipilih. Saldo yang sudah ada{" "}
            <strong>tidak akan ditimpa</strong>.
          </p>
          {genResult ? (
            <div className="space-y-2">
              {genResult.error ? (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl">
                  <AlertCircle
                    size={16}
                    className="text-red-500 shrink-0 mt-0.5"
                  />
                  <p className="text-sm text-red-700">{genResult.error}</p>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 bg-green-50 rounded-xl">
                  <CheckCircle
                    size={16}
                    className="text-green-600 shrink-0 mt-0.5"
                  />
                  <div className="text-sm text-green-700">
                    <p className="font-medium">Generate berhasil!</p>
                    <p>
                      {genResult.created} saldo baru dibuat ·{" "}
                      {genResult.skipped} sudah ada (dilewati)
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="form-label">Tahun *</label>
                <select
                  className="form-input"
                  value={genYear}
                  onChange={(e) => setGenYear(e.target.value)}
                >
                  {Array.from(
                    { length: 5 },
                    (_, i) => new Date().getFullYear() + 1 - i,
                  ).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Group (opsional)</label>
                <select
                  className="form-input"
                  value={genGroup}
                  onChange={(e) => setGenGroup(e.target.value)}
                >
                  <option value="all">Semua Group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setGenModal(false)} className="btn-secondary">
            {genResult ? "Tutup" : "Batal"}
          </button>
          {!genResult && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn-primary"
            >
              {generating ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <RefreshCw size={14} />
              )}
              {generating ? "Generating..." : "Generate"}
            </button>
          )}
        </div>
      </Modal>

      {/* ── Detail Balance Modal ── */}
      <Modal
        open={!!detailBal}
        onClose={() => setDetailBal(null)}
        title="Detail Saldo Cuti"
        width="max-w-sm"
      >
        {detailBal &&
          (() => {
            const limit = detailBal.leave_category?.limit_per_year;
            const taken =
              (detailBal.annual_taken ?? 0) + (detailBal.other_taken ?? 0);
            const sisa = limit != null ? Math.max(0, limit - taken) : null;
            return (
              <div className="space-y-3 text-sm">
                {[
                  { label: "Karyawan", value: detailBal.employee?.full_name },
                  { label: "Kode", value: detailBal.employee?.employee_code },
                  {
                    label: "Grup",
                    value: detailBal.employee?.group?.name || "-",
                  },
                  {
                    label: "Jenis Cuti",
                    value: detailBal.leave_category?.leave_name,
                  },
                  { label: "Tahun", value: detailBal.year },
                  {
                    label: "Limit / Tahun",
                    value: limit != null ? `${limit} hari` : "Tidak terbatas",
                  },
                  {
                    label: "Terpakai (Tahunan)",
                    value: `${detailBal.annual_taken ?? 0} hari`,
                  },
                  {
                    label: "Terpakai (Lainnya)",
                    value: `${detailBal.other_taken ?? 0} hari`,
                  },
                  { label: "Sisa", value: sisa != null ? `${sisa} hari` : "∞" },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex justify-between py-1.5 border-b border-gray-50 last:border-0"
                  >
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-900">{value}</span>
                  </div>
                ))}
                {limit != null && (
                  <div className="pt-1">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Terpakai</span>
                      <span>
                        {taken}/{limit}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${taken >= limit ? "bg-red-500" : taken >= limit * 0.75 ? "bg-orange-400" : "bg-green-500"}`}
                        style={{
                          width: `${Math.min(100, (taken / limit) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        <div className="flex justify-end mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setDetailBal(null)} className="btn-secondary">
            Tutup
          </button>
        </div>
      </Modal>

      {/* ── Edit Balance Modal ── */}
      <Modal
        open={!!editBal}
        onClose={() => setEditBal(null)}
        title="Edit Saldo Cuti"
        width="max-w-sm"
      >
        {editBal && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-xl text-sm">
              <p className="font-medium text-gray-900">
                {editBal.employee?.full_name}
              </p>
              <p className="text-gray-500 text-xs">
                {editBal.leave_category?.leave_name} · {editBal.year}
              </p>
            </div>
            {editBalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {editBalError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Annual Taken</label>
                <input
                  type="number"
                  min={0}
                  className="form-input"
                  value={editAnnual}
                  onChange={(e) => setEditAnnual(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Other Taken</label>
                <input
                  type="number"
                  min={0}
                  className="form-input"
                  value={editOther}
                  onChange={(e) => setEditOther(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Limit:{" "}
              {editBal.leave_category?.limit_per_year != null
                ? `${editBal.leave_category.limit_per_year} hari`
                : "Tidak terbatas"}
            </p>
          </div>
        )}
        <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setEditBal(null)} className="btn-secondary">
            Batal
          </button>
          <button
            onClick={handleSaveBal}
            disabled={savingBal}
            className="btn-primary"
          >
            {savingBal ? <Spinner className="w-4 h-4" /> : null} Simpan
          </button>
        </div>
      </Modal>

      {/* ── Add/Edit Category Modal ── */}
      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={editCat ? "Edit Leave Category" : "Add Leave Category"}
        width="max-w-md"
      >
        <div className="space-y-3">
          {catError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {catError}
            </div>
          )}
          <div>
            <label className="form-label">Leave Type</label>
            <select
              className="form-input"
              value={fType}
              onChange={(e) => setFType(e.target.value)}
            >
              <option value="annual">Annual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="special">Special Leave</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="form-label">Leave Name *</label>
            <input
              className="form-input"
              value={fName}
              onChange={(e) => setFName(e.target.value)}
              placeholder="Cuti Tahunan"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Leave Limit per Year</label>
              <input
                className="form-input"
                type="number"
                min={0}
                value={fLimit}
                onChange={(e) => setFLimit(e.target.value)}
                placeholder="Kosong = tidak terbatas"
              />
            </div>
            <div>
              <label className="form-label">Amount per Taken</label>
              <select
                className="form-input"
                value={fAmount}
                onChange={(e) =>
                  setFAmount(e.target.value as "as_requested" | "fixed")
                }
              >
                <option value="as_requested">As Requested</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            <div>
              <label className="form-label">Min Working Period (days)</label>
              <input
                className="form-input"
                type="number"
                min={0}
                value={fMinPeriod}
                onChange={(e) => setFMinPeriod(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Approval Level</label>
              <input
                className="form-input"
                type="number"
                min={1}
                value={fApproval}
                onChange={(e) => setFApproval(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-gray-100">
          <button
            onClick={() => setCatModalOpen(false)}
            className="btn-secondary"
          >
            Batal
          </button>
          <button
            onClick={handleSaveCat}
            disabled={savingCat}
            className="btn-primary"
          >
            {savingCat ? <Spinner className="w-4 h-4" /> : null} Simpan
          </button>
        </div>
      </Modal>

      {/* ── Delete Category Modal ── */}
      <Modal
        open={!!deleteCat}
        onClose={() => setDeleteCat(null)}
        title="Hapus Kategori Cuti"
        width="max-w-sm"
      >
        <p className="text-sm text-gray-600 mb-5">
          Yakin ingin menghapus kategori{" "}
          <strong>{deleteCat?.leave_name}</strong>?
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setDeleteCat(null)} className="btn-secondary">
            Batal
          </button>
          <button onClick={handleDeleteCat} className="btn-danger">
            Hapus
          </button>
        </div>
      </Modal>
    </div>
  );
}
