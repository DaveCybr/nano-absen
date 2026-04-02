import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { Download, Search, Columns, FileText, FileSpreadsheet } from "lucide-react";
import { Spinner, EmptyState, Pagination, formatMinutes } from "../../components/ui";
import { exportCsv, exportXlsx, csvMins } from "../../lib/exportCsv";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

const ALL_COLUMNS = [
  { key: "employee_code",     label: "Kode" },
  { key: "full_name",         label: "Nama" },
  { key: "deduction_minutes", label: "Waktu Terlambat" },
  { key: "deduction_amount",  label: "Potongan (Rp)" },
  { key: "work_minutes",      label: "Jam Kerja" },
  { key: "work_amount",       label: "Pendapatan (Rp)" },
] as const;

type ColKey = typeof ALL_COLUMNS[number]["key"];

export default function MonthlyReportPage() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate]     = useState(today);
  const [groupFilter, setGroupFilter] = useState("all");
  const [groups, setGroups]       = useState<Group[]>([]);
  const [rows, setRows]           = useState<MonthlyRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(10);
  const [total, setTotal]         = useState(0);
  const [summary, setSummary]     = useState({ total_late: 0, total_deduction: 0, total_work: 0, total_payroll: 0 });

  const [selectedCols, setSelectedCols] = useState<Set<ColKey>>(new Set(ALL_COLUMNS.map(c => c.key)));
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  const [downloading, setDownloading]       = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node))
        setShowColPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    supabase.from("groups").select("id,name").order("name")
      .then(({ data }) => setGroups((data as Group[]) || []));
  }, []);

  const toggleCol = (key: ColKey) => {
    setSelectedCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size === 1) return prev; next.delete(key); }
      else next.add(key);
      return next;
    });
  };

  const fetchExportData = async () => {
    let empQuery = supabase.from("employees").select("id,full_name,employee_code")
      .eq("is_active", true).order("full_name");
    if (groupFilter !== "all") empQuery = empQuery.eq("group_id", groupFilter);
    const { data: employees } = await empQuery;
    if (!employees?.length) return [];

    const empIds = employees.map(e => e.id);
    const { data: attendances } = await supabase
      .from("attendances")
      .select("employee_id,late_minutes,deduction_amount,work_minutes")
      .in("employee_id", empIds)
      .gte("attendance_date", startDate)
      .lte("attendance_date", endDate);

    const attMap = (attendances || []).reduce<Record<string, any[]>>((acc, r) => {
      if (!acc[r.employee_id]) acc[r.employee_id] = [];
      acc[r.employee_id].push(r);
      return acc;
    }, {});

    return employees.map(emp => {
      const d = attMap[emp.id] || [];
      return {
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        deduction_minutes: d.reduce((s, r) => s + (r.late_minutes || 0), 0),
        deduction_amount:  d.reduce((s, r) => s + (r.deduction_amount || 0), 0),
        work_minutes:      d.reduce((s, r) => s + (r.work_minutes || 0), 0),
        work_amount: 0,
      };
    });
  };

  const getCellStr = (r: any, key: ColKey): string => {
    switch (key) {
      case "employee_code":     return r.employee_code;
      case "full_name":         return r.full_name;
      case "deduction_minutes": return csvMins(r.deduction_minutes);
      case "deduction_amount":  return `Rp ${r.deduction_amount.toLocaleString("id-ID")}`;
      case "work_minutes":      return csvMins(r.work_minutes);
      case "work_amount":       return `Rp ${r.work_amount.toLocaleString("id-ID")}`;
      default:                  return "";
    }
  };

  const getCellXlsx = (r: any, key: ColKey): string | number => {
    switch (key) {
      case "employee_code":     return r.employee_code;
      case "full_name":         return r.full_name;
      case "deduction_minutes": return r.deduction_minutes;
      case "deduction_amount":  return r.deduction_amount;
      case "work_minutes":      return r.work_minutes;
      case "work_amount":       return r.work_amount;
      default:                  return "";
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const data = await fetchExportData();
      if (!data.length) return;
      const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key));
      exportCsv(
        `monthly-report_${startDate}_${endDate}`,
        activeCols.map(c => c.label),
        data.map(r => activeCols.map(c => getCellStr(r, c.key))),
      );
    } finally { setDownloading(false); }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const data = await fetchExportData();
      if (!data.length) return;
      const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key));
      const doc = new jsPDF({ orientation: activeCols.length > 4 ? "landscape" : "portrait", unit: "mm", format: "a4" });
      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text("Monthly Report", 14, 16);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(120);
      doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 23);
      doc.text(`Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`, 14, 28);
      doc.setTextColor(0);
      autoTable(doc, {
        head: [activeCols.map(c => c.label)],
        body: data.map(r => activeCols.map(c => getCellStr(r, c.key))),
        startY: 33,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });
      doc.save(`monthly-report_${startDate}_${endDate}.pdf`);
    } finally { setDownloadingPdf(false); }
  };

  const handleDownloadXlsx = async () => {
    setDownloadingXlsx(true);
    try {
      const data = await fetchExportData();
      if (!data.length) return;
      const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key));
      exportXlsx(
        `monthly-report_${startDate}_${endDate}`,
        activeCols.map(c => c.label),
        data.map(r => activeCols.map(c => getCellXlsx(r, c.key))),
      );
    } finally { setDownloadingXlsx(false); }
  };

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      let empQuery = supabase.from("employees")
        .select("id,full_name,employee_code", { count: "exact" })
        .eq("is_active", true).order("full_name")
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (groupFilter !== "all") empQuery = empQuery.eq("group_id", groupFilter);
      const { data: employees, count } = await empQuery;
      if (!employees) { setLoading(false); return; }
      setTotal(count || 0);

      const empIds = employees.map(e => e.id);
      const { data: attendances } = await supabase
        .from("attendances")
        .select("employee_id,late_minutes,deduction_amount,work_minutes")
        .in("employee_id", empIds)
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate);

      const attMap = (attendances || []).reduce<Record<string, any[]>>((acc, r) => {
        if (!acc[r.employee_id]) acc[r.employee_id] = [];
        acc[r.employee_id].push(r);
        return acc;
      }, {});

      const results: MonthlyRow[] = employees.map(emp => {
        const d = attMap[emp.id] || [];
        return {
          employee_id: emp.id,
          full_name: emp.full_name,
          employee_code: emp.employee_code,
          deduction_minutes: d.reduce((s, r) => s + (r.late_minutes || 0), 0),
          deduction_amount:  d.reduce((s, r) => s + (r.deduction_amount || 0), 0),
          work_minutes:      d.reduce((s, r) => s + (r.work_minutes || 0), 0),
          work_amount: 0,
        };
      });
      setRows(results);
      setSummary({
        total_late:      results.reduce((s, r) => s + r.deduction_minutes, 0),
        total_deduction: results.reduce((s, r) => s + r.deduction_amount, 0),
        total_work:      results.reduce((s, r) => s + r.work_minutes, 0),
        total_payroll: 0,
      });
    } finally { setLoading(false); }
  }, [startDate, endDate, groupFilter, page, pageSize]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  return (
    <div>
      <h1 className="page-title mb-6">Monthly Report</h1>

      <div className="card p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="form-label">Start Date</label>
            <input type="date" className="form-input w-40" value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="form-label">End Date</label>
            <input type="date" className="form-input w-40" value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="form-label">Find a Group</label>
            <select className="form-input w-40" value={groupFilter}
              onChange={e => { setGroupFilter(e.target.value); setPage(1); }}>
              <option value="all">All Group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <button onClick={fetchReport} className="btn-primary"><Search size={14} /> Search</button>

          <div className="flex items-center gap-2 ml-auto">
            {/* Column picker */}
            <div className="relative" ref={colPickerRef}>
              <button onClick={() => setShowColPicker(v => !v)} className="btn-secondary" title="Pilih kolom export">
                <Columns size={14} /> Kolom ({selectedCols.size}/{ALL_COLUMNS.length})
              </button>
              {showColPicker && (
                <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-2 min-w-[180px]">
                  <div className="px-3 pb-1.5 mb-1 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kolom</span>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedCols(new Set(ALL_COLUMNS.map(c => c.key)))} className="text-xs text-blue-500 hover:underline">Semua</button>
                      <span className="text-gray-200">|</span>
                      <button onClick={() => setSelectedCols(new Set([ALL_COLUMNS[0].key]))} className="text-xs text-gray-400 hover:underline">Reset</button>
                    </div>
                  </div>
                  {ALL_COLUMNS.map(col => (
                    <label key={col.key} className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-gray-50 select-none">
                      <input type="checkbox" checked={selectedCols.has(col.key)} onChange={() => toggleCol(col.key)} className="w-3.5 h-3.5 accent-blue-600 rounded" />
                      <span className="text-sm text-gray-700">{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleDownload} disabled={downloading} className="btn-secondary">
              {downloading ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Download size={14} />}
              {downloading ? "Mengunduh..." : "CSV"}
            </button>
            <button onClick={handleDownloadPdf} disabled={downloadingPdf} className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">
              {downloadingPdf ? <span className="w-3.5 h-3.5 border-2 border-red-300 border-t-transparent rounded-full animate-spin" /> : <FileText size={14} />}
              {downloadingPdf ? "Mengunduh..." : "PDF"}
            </button>
            <button onClick={handleDownloadXlsx} disabled={downloadingXlsx} className="btn-secondary text-green-700 border-green-200 hover:bg-green-50">
              {downloadingXlsx ? <span className="w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /> : <FileSpreadsheet size={14} />}
              {downloadingXlsx ? "Mengunduh..." : "Excel"}
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Late",          value: formatMinutes(summary.total_late),                                    color: "text-red-600" },
          { label: "Total Deduction",     value: `Rp ${summary.total_deduction.toLocaleString("id-ID")}`,             color: "text-orange-600" },
          { label: "Total Working Hours", value: formatMinutes(summary.total_work),                                    color: "text-green-600" },
          { label: "Total Payroll",       value: `Rp ${summary.total_payroll.toLocaleString("id-ID")}`,               color: "text-blue-600" },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
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
                <tr><td colSpan={5} className="text-center py-16"><Spinner className="mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <EmptyState message="Tidak ada data" />
              ) : (
                rows.map(row => (
                  <tr key={row.employee_id} className="hover:bg-gray-50/60">
                    <td>
                      <p className="font-medium text-gray-900">{row.full_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{row.employee_code}</p>
                    </td>
                    <td className="font-mono text-sm text-red-600">
                      {row.deduction_minutes > 0 ? formatMinutes(row.deduction_minutes) : "0 hrs 0 min"}
                    </td>
                    <td className="text-gray-600">Rp {row.deduction_amount.toLocaleString("id-ID")}</td>
                    <td className="font-mono text-sm text-green-600">
                      {row.work_minutes > 0 ? formatMinutes(row.work_minutes) : "0 hrs 0 min"}
                    </td>
                    <td className="text-gray-600">Rp {row.work_amount.toLocaleString("id-ID")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
      </div>
    </div>
  );
}
