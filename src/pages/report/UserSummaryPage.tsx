import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { Download, Search, Columns, FileText, FileSpreadsheet } from "lucide-react";
import { Spinner, EmptyState, Pagination } from "../../components/ui";
import { exportCsv, exportXlsx } from "../../lib/exportCsv";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Group } from "../../types";

interface SummaryRow {
  employee_id: string;
  full_name: string;
  face_photo_url: string | null;
  position: string;
  group_name: string;
  on_time: number;
  in_tolerance: number;
  late: number;
  leave: number;
  correction_time: number;
  in_location: number;
  tolerance_location: number;
  out_location: number;
  correction_location: number;
  total_present: number;
  absent: number;
}

const ALL_COLUMNS = [
  { key: "full_name",           label: "Nama" },
  { key: "position",            label: "Jabatan" },
  { key: "group_name",          label: "Grup" },
  { key: "on_time",             label: "Tepat Waktu" },
  { key: "in_tolerance",        label: "Toleransi" },
  { key: "late",                label: "Terlambat" },
  { key: "leave",               label: "Cuti" },
  { key: "correction_time",     label: "Koreksi Waktu" },
  { key: "in_location",         label: "Dalam Lokasi" },
  { key: "tolerance_location",  label: "Toleransi Lokasi" },
  { key: "out_location",        label: "Diluar Lokasi" },
  { key: "correction_location", label: "Koreksi Lokasi" },
  { key: "total_present",       label: "Total Hadir" },
  { key: "absent",              label: "Tidak Hadir" },
] as const;

type ColKey = typeof ALL_COLUMNS[number]["key"];

export default function UserSummaryPage() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];

  const [startDate, setStartDate]     = useState(firstOfMonth);
  const [endDate, setEndDate]         = useState(today);
  const [groupFilter, setGroupFilter] = useState("all");
  const [groups, setGroups]           = useState<Group[]>([]);
  const [rows, setRows]               = useState<SummaryRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(10);
  const [total, setTotal]             = useState(0);

  const [selectedCols, setSelectedCols]   = useState<Set<ColKey>>(new Set(ALL_COLUMNS.map(c => c.key)));
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  const [downloading, setDownloading]         = useState(false);
  const [downloadingPdf, setDownloadingPdf]   = useState(false);
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

  const workingDays = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
  ) + 1;

  const toggleCol = (key: ColKey) => {
    setSelectedCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size === 1) return prev; next.delete(key); }
      else next.add(key);
      return next;
    });
  };

  const fetchExportData = async () => {
    let empQuery = supabase.from("employees")
      .select("id,full_name,group:groups(name),position:positions(name)")
      .eq("is_active", true).order("full_name");
    if (groupFilter !== "all") empQuery = empQuery.eq("group_id", groupFilter);
    const { data: employees } = await empQuery;
    if (!employees?.length) return [];

    const empIds = employees.map((e: any) => e.id);
    const { data: attendances } = await supabase
      .from("attendances").select("employee_id,status_in,location_in_status,time_out")
      .in("employee_id", empIds)
      .gte("attendance_date", startDate).lte("attendance_date", endDate);

    const attMap = (attendances || []).reduce<Record<string, any[]>>((acc, r) => {
      if (!acc[r.employee_id]) acc[r.employee_id] = [];
      acc[r.employee_id].push(r);
      return acc;
    }, {});

    return (employees as any[]).map(emp => {
      const d = attMap[emp.id] || [];
      const total_present = d.filter((r: any) => r.time_out).length;
      return {
        full_name:           emp.full_name,
        position:            emp.position?.name ?? "-",
        group_name:          emp.group?.name ?? "-",
        on_time:             d.filter((r: any) => r.status_in === "on_time").length,
        in_tolerance:        d.filter((r: any) => r.status_in === "in_tolerance").length,
        late:                d.filter((r: any) => r.status_in === "late").length,
        leave:               0,
        correction_time:     d.filter((r: any) => r.status_in === "others").length,
        in_location:         d.filter((r: any) => r.location_in_status === "in_area").length,
        tolerance_location:  d.filter((r: any) => r.location_in_status === "tolerance").length,
        out_location:        d.filter((r: any) => r.location_in_status === "out_of_area").length,
        correction_location: d.filter((r: any) => r.location_in_status === "correction").length,
        total_present,
        absent: Math.max(0, workingDays - d.length),
      };
    });
  };

  const getCellValue = (r: any, key: ColKey): string | number => r[key] ?? "";

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const data = await fetchExportData();
      if (!data.length) return;
      const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key));
      exportCsv(
        `user-summary_${startDate}_${endDate}`,
        activeCols.map(c => c.label),
        data.map(r => activeCols.map(c => getCellValue(r, c.key))),
      );
    } finally { setDownloading(false); }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const data = await fetchExportData();
      if (!data.length) return;
      const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key));
      const doc = new jsPDF({ orientation: activeCols.length > 6 ? "landscape" : "portrait", unit: "mm", format: "a4" });
      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text("User Summary", 14, 16);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(120);
      doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 23);
      doc.text(`Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`, 14, 28);
      doc.setTextColor(0);
      autoTable(doc, {
        head: [activeCols.map(c => c.label)],
        body: data.map(r => activeCols.map(c => String(getCellValue(r, c.key)))),
        startY: 33,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });
      doc.save(`user-summary_${startDate}_${endDate}.pdf`);
    } finally { setDownloadingPdf(false); }
  };

  const handleDownloadXlsx = async () => {
    setDownloadingXlsx(true);
    try {
      const data = await fetchExportData();
      if (!data.length) return;
      const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key));
      exportXlsx(
        `user-summary_${startDate}_${endDate}`,
        activeCols.map(c => c.label),
        data.map(r => activeCols.map(c => getCellValue(r, c.key))),
      );
    } finally { setDownloadingXlsx(false); }
  };

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      let empQuery = supabase.from("employees")
        .select("id,full_name,employee_code,face_photo_url,group:groups(name),position:positions(name)", { count: "exact" })
        .eq("is_active", true).order("full_name")
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (groupFilter !== "all") empQuery = empQuery.eq("group_id", groupFilter);
      const { data: employees, count } = await empQuery;
      if (!employees) { setLoading(false); return; }
      setTotal(count || 0);

      const empIds = employees.map((e: any) => e.id);
      const { data: attendances } = await supabase
        .from("attendances").select("employee_id,status_in,location_in_status,time_out")
        .in("employee_id", empIds)
        .gte("attendance_date", startDate).lte("attendance_date", endDate);

      const attMap = (attendances || []).reduce<Record<string, any[]>>((acc, r) => {
        if (!acc[r.employee_id]) acc[r.employee_id] = [];
        acc[r.employee_id].push(r);
        return acc;
      }, {});

      setRows((employees as any[]).map(emp => {
        const d = attMap[emp.id] || [];
        const total_present = d.filter((r: any) => r.time_out).length;
        return {
          employee_id: emp.id,
          full_name: emp.full_name,
          face_photo_url: emp.face_photo_url || null,
          position: emp.position?.name || "-",
          group_name: emp.group?.name || "-",
          on_time:             d.filter((r: any) => r.status_in === "on_time").length,
          in_tolerance:        d.filter((r: any) => r.status_in === "in_tolerance").length,
          late:                d.filter((r: any) => r.status_in === "late").length,
          leave: 0,
          correction_time:     d.filter((r: any) => r.status_in === "others").length,
          in_location:         d.filter((r: any) => r.location_in_status === "in_area").length,
          tolerance_location:  d.filter((r: any) => r.location_in_status === "tolerance").length,
          out_location:        d.filter((r: any) => r.location_in_status === "out_of_area").length,
          correction_location: d.filter((r: any) => r.location_in_status === "correction").length,
          total_present,
          absent: Math.max(0, workingDays - d.length),
        };
      }));
    } finally { setLoading(false); }
  }, [startDate, endDate, groupFilter, page, pageSize, workingDays]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const numCell = (val: number, color = "text-gray-700") => (
    <td className={`text-center font-medium ${val > 0 ? color : "text-gray-400"}`}>{val}</td>
  );

  return (
    <div>
      <h1 className="page-title mb-6">User Summary</h1>

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
            <label className="form-label">Select Group</label>
            <select className="form-input w-40" value={groupFilter}
              onChange={e => { setGroupFilter(e.target.value); setPage(1); }}>
              <option value="all">All Group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <button onClick={fetchSummary} className="btn-primary"><Search size={14} /> Search</button>

          <div className="flex items-center gap-2 ml-auto">
            <div className="relative" ref={colPickerRef}>
              <button onClick={() => setShowColPicker(v => !v)} className="btn-secondary" title="Pilih kolom export">
                <Columns size={14} /> Kolom ({selectedCols.size}/{ALL_COLUMNS.length})
              </button>
              {showColPicker && (
                <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-2 min-w-[190px]">
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

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="data-table w-full text-xs">
          <thead>
            <tr>
              <th className="text-left min-w-[140px]">Employee Name</th>
              <th>Position</th>
              <th>Group</th>
              <th className="text-center text-green-600">On Time</th>
              <th className="text-center text-yellow-600">In Tolerance</th>
              <th className="text-center text-red-600">Late</th>
              <th className="text-center text-purple-600">Leave</th>
              <th className="text-center text-blue-600">Correction Time</th>
              <th className="text-center text-green-600">In Location</th>
              <th className="text-center text-yellow-600">Tolerance Location</th>
              <th className="text-center text-red-600">Out of Location</th>
              <th className="text-center text-blue-600">Correction Location</th>
              <th className="text-center text-gray-700 font-bold">Total Present</th>
              <th className="text-center text-red-700">Absent</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} className="text-center py-16"><Spinner className="mx-auto" /></td></tr>
            ) : rows.length === 0 ? (
              <EmptyState message="Tidak ada data" />
            ) : (
              rows.map(row => (
                <tr key={row.employee_id} className="hover:bg-gray-50/60">
                  <td>
                    <div className="flex items-center gap-2">
                      {row.face_photo_url
                        ? <img src={row.face_photo_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-gray-200" />
                        : <div className="w-7 h-7 rounded-full shrink-0 bg-blue-100 flex items-center justify-center text-blue-600 text-[11px] font-bold">{row.full_name.charAt(0)}</div>
                      }
                      <span className="font-medium text-gray-900">{row.full_name}</span>
                    </div>
                  </td>
                  <td className="text-gray-500">{row.position}</td>
                  <td><span className="badge badge-gray">{row.group_name}</span></td>
                  {numCell(row.on_time, "text-green-600")}
                  {numCell(row.in_tolerance, "text-yellow-600")}
                  {numCell(row.late, "text-red-600")}
                  {numCell(row.leave, "text-purple-600")}
                  {numCell(row.correction_time, "text-blue-600")}
                  {numCell(row.in_location, "text-green-600")}
                  {numCell(row.tolerance_location, "text-yellow-600")}
                  {numCell(row.out_location, "text-red-600")}
                  {numCell(row.correction_location, "text-blue-600")}
                  <td className="text-center font-bold text-gray-900">{row.total_present}</td>
                  {numCell(row.absent, "text-red-700")}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
      </div>
    </div>
  );
}
