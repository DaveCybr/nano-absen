import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { Download, Search } from "lucide-react";
import {
  Spinner,
  EmptyState,
  Pagination,
  formatMinutes,
} from "../../components/ui";
import { exportCsv, csvMins } from "../../lib/exportCsv";
import type { Group } from "../../types";

interface MonthlyRow {
  employee_id: string;
  full_name: string;
  employee_code: string;
  deduction_minutes: number;
  deduction_amount: number;
  work_minutes: number;
  work_amount: number;
}

export default function MonthlyReportPage() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  )
    .toISOString()
    .split("T")[0];

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [groupFilter, setGroupFilter] = useState("all");
  const [groups, setGroups] = useState<Group[]>([]);
  const [rows, setRows] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [summary, setSummary] = useState({
    total_late: 0,
    total_deduction: 0,
    total_work: 0,
    total_payroll: 0,
  });

  useEffect(() => {
    supabase
      .from("groups")
      .select("id,name")
      .order("name")
      .then(({ data }) => setGroups((data as Group[]) || []));
  }, []);

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      let empQuery = supabase
        .from("employees")
        .select("id,full_name,employee_code")
        .eq("is_active", true)
        .order("full_name");
      if (groupFilter !== "all")
        empQuery = empQuery.eq("group_id", groupFilter);
      const { data: employees } = await empQuery;
      if (!employees?.length) return;

      const empIds = employees.map((e) => e.id);
      const { data: attendances } = await supabase
        .from("attendances")
        .select("employee_id,late_minutes,deduction_amount,work_minutes")
        .in("employee_id", empIds)
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate);

      const attMap = (attendances || []).reduce<
        Record<string, typeof attendances>
      >((acc, r) => {
        if (!acc[r.employee_id]) acc[r.employee_id] = [];
        acc[r.employee_id]?.push(r);
        return acc;
      }, {});

      exportCsv(
        `monthly-report_${startDate}_${endDate}`,
        ["Kode", "Nama", "Waktu Terlambat", "Potongan (Rp)", "Jam Kerja"],
        employees.map((emp) => {
          const d = attMap[emp.id] || [];
          return [
            emp.employee_code,
            emp.full_name,
            csvMins(d.reduce((s, r) => s + (r.late_minutes || 0), 0)),
            d.reduce((s, r) => s + (r.deduction_amount || 0), 0),
            csvMins(d.reduce((s, r) => s + (r.work_minutes || 0), 0)),
          ];
        }),
      );
    } finally {
      setDownloading(false);
    }
  };

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      let empQuery = supabase
        .from("employees")
        .select("id,full_name,employee_code", { count: "exact" })
        .eq("is_active", true)
        .order("full_name")
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (groupFilter !== "all")
        empQuery = empQuery.eq("group_id", groupFilter);

      const { data: employees, count } = await empQuery;
      if (!employees) {
        setLoading(false);
        return;
      }

      setTotal(count || 0);

      const empIds = employees.map((e) => e.id);

      // Single batch query — no more N+1
      const { data: attendances } = await supabase
        .from("attendances")
        .select("employee_id,late_minutes,deduction_amount,work_minutes")
        .in("employee_id", empIds)
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate);

      const attMap = (attendances || []).reduce<
        Record<string, typeof attendances>
      >((acc, r) => {
        if (!acc[r.employee_id]) acc[r.employee_id] = [];
        acc[r.employee_id]?.push(r);
        return acc;
      }, {});

      const results: MonthlyRow[] = employees.map((emp) => {
        const d = attMap[emp.id] || [];
        return {
          employee_id: emp.id,
          full_name: emp.full_name,
          employee_code: emp.employee_code,
          deduction_minutes: d.reduce((s, r) => s + (r.late_minutes || 0), 0),
          deduction_amount: d.reduce(
            (s, r) => s + (r.deduction_amount || 0),
            0,
          ),
          work_minutes: d.reduce((s, r) => s + (r.work_minutes || 0), 0),
          work_amount: 0,
        };
      });

      setRows(results);
      setSummary({
        total_late: results.reduce((s, r) => s + r.deduction_minutes, 0),
        total_deduction: results.reduce((s, r) => s + r.deduction_amount, 0),
        total_work: results.reduce((s, r) => s + r.work_minutes, 0),
        total_payroll: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, groupFilter, page, pageSize]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div>
      <h1 className="page-title mb-6">Monthly Report</h1>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-input w-40"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-input w-40"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="form-label">Find a Group</label>
            <select
              className="form-input w-40"
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
                setPage(1);
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
          <button onClick={fetchReport} className="btn-primary">
            <Search size={14} /> Search
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn-secondary ml-auto"
          >
            {downloading ? (
              <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {downloading ? "Mengunduh..." : "Download Report"}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          {
            label: "Total Late",
            value: formatMinutes(summary.total_late),
            color: "text-red-600",
          },
          {
            label: "Total Deduction",
            value: `Rp ${summary.total_deduction.toLocaleString("id-ID")}`,
            color: "text-orange-600",
          },
          {
            label: "Total Working Hours",
            value: formatMinutes(summary.total_work),
            color: "text-green-600",
          },
          {
            label: "Total Payroll",
            value: `Rp ${summary.total_payroll.toLocaleString("id-ID")}`,
            color: "text-blue-600",
          },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-xl font-bold font-mono ${s.color}`}>
              {s.value}
            </p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Deduction Time</th>
                <th>Deduction Rp</th>
                <th>Work Time</th>
                <th>Work Rp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <Spinner className="mx-auto" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <EmptyState message="Tidak ada data" />
              ) : (
                rows.map((row) => (
                  <tr key={row.employee_id} className="hover:bg-gray-50/60">
                    <td>
                      <p className="font-medium text-gray-900">
                        {row.full_name}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">
                        {row.employee_code}
                      </p>
                    </td>
                    <td className="font-mono text-sm text-red-600">
                      {row.deduction_minutes > 0
                        ? formatMinutes(row.deduction_minutes)
                        : "0 hrs 0 min"}
                    </td>
                    <td className="text-gray-600">
                      Rp {row.deduction_amount.toLocaleString("id-ID")}
                    </td>
                    <td className="font-mono text-sm text-green-600">
                      {row.work_minutes > 0
                        ? formatMinutes(row.work_minutes)
                        : "0 hrs 0 min"}
                    </td>
                    <td className="text-gray-600">
                      Rp {row.work_amount.toLocaleString("id-ID")}
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
          total={total}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      </div>
    </div>
  );
}
