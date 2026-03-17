import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { Download, Search, FileText } from "lucide-react";
import { exportCsv, csvTime, csvMins } from "../../lib/exportCsv";
import {
  Spinner,
  EmptyState,
  StatusBadge,
  LocationBadge,
  Pagination,
  Modal,
  formatTime,
  formatMinutes,
} from "../../components/ui";
import type { Attendance, Employee, Group } from "../../types";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const iconIn = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const iconOut = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

interface AttendanceRow extends Attendance {
  employee: Employee & { group: Group | null };
}

interface DetailData {
  attendance: AttendanceRow;
  employee: Employee & { group: Group | null };
}

export default function SummaryReport() {
  const today = new Date().toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [groupFilter, setGroupFilter] = useState("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Stats
  const [stats, setStats] = useState({
    on_time: 0,
    in_tolerance: 0,
    late: 0,
    correction: 0,
    in_location: 0,
    in_tolerance_location: 0,
    out_location: 0,
    correction_location: 0,
  });

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      let q = supabase
        .from("attendances")
        .select(`*, employee:employees(full_name, employee_code, group:groups(name))`)
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate)
        .order("attendance_date", { ascending: false });

      if (groupFilter !== "all") q = q.eq("employees.group_id", groupFilter);
      if (userFilter !== "all") q = q.eq("employee_id", userFilter);

      const { data } = await q;
      const rows = (data || []) as AttendanceRow[];

      exportCsv(`summary-report_${startDate}_${endDate}`, [
        "Tanggal", "Nama", "Kode", "Grup",
        "Jam Masuk", "Status Masuk", "Lokasi Masuk",
        "Jam Keluar", "Status Keluar", "Jam Kerja", "Terlambat",
      ], rows.map(r => [
        r.attendance_date,
        r.employee?.full_name ?? '',
        r.employee?.employee_code ?? '',
        r.employee?.group?.name ?? '',
        csvTime(r.time_in), r.status_in ?? '', r.location_in_status ?? '',
        csvTime(r.time_out), r.status_out ?? '',
        csvMins(r.work_minutes), csvMins(r.late_minutes),
      ]));
    } finally {
      setDownloading(false);
    }
  };

  // Detail modal
  const [detail, setDetail] = useState<DetailData | null>(null);

  // Load groups & employees for filters
  useEffect(() => {
    supabase
      .from("groups")
      .select("id,name")
      .order("name")
      .then(({ data }) => setGroups((data as Group[]) || []));
    supabase
      .from("employees")
      .select("id,full_name,employee_code")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setEmployees((data as Employee[]) || []));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("attendances")
        .select(
          `
          *,
          employee:employees(
            id, full_name, employee_code, email, face_photo_url,
            group:groups(id, name)
          )
        `,
          { count: "exact" },
        )
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate)
        .order("attendance_date", { ascending: false })
        .order("time_in", { ascending: true });

      if (groupFilter !== "all") {
        query = query.eq("employees.group_id", groupFilter);
      }
      if (userFilter !== "all") {
        query = query.eq("employee_id", userFilter);
      }

      const { data, count, error } = await query.range(
        (page - 1) * pageSize,
        page * pageSize - 1,
      );

      if (error) throw error;

      setRows((data || []) as AttendanceRow[]);
      setTotal(count || 0);

      // Stats: same filters, minimal columns, no pagination
      let statsQuery = supabase
        .from("attendances")
        .select("status_in,location_in_status")
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate);

      if (groupFilter !== "all") statsQuery = statsQuery.eq("employees.group_id", groupFilter);
      if (userFilter !== "all") statsQuery = statsQuery.eq("employee_id", userFilter);

      const { data: statsData } = await statsQuery;
      if (statsData) {
        setStats({
          on_time:               statsData.filter((r) => r.status_in === "on_time").length,
          in_tolerance:          statsData.filter((r) => r.status_in === "in_tolerance").length,
          late:                  statsData.filter((r) => r.status_in === "late").length,
          correction:            statsData.filter((r) => r.status_in === "others").length,
          in_location:           statsData.filter((r) => r.location_in_status === "in_area").length,
          in_tolerance_location: statsData.filter((r) => r.location_in_status === "tolerance").length,
          out_location:          statsData.filter((r) => r.location_in_status === "out_of_area").length,
          correction_location:   statsData.filter((r) => r.location_in_status === "correction").length,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, groupFilter, userFilter, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group rows by date
  const grouped = rows.reduce<Record<string, AttendanceRow[]>>((acc, row) => {
    const d = row.attendance_date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(row);
    return acc;
  }, {});

  const statItems = [
    { label: "On Time", value: stats.on_time, color: "text-green-600" },
    {
      label: "In Tolerance",
      value: stats.in_tolerance,
      color: "text-yellow-600",
    },
    { label: "Late", value: stats.late, color: "text-red-600" },
    {
      label: "Correction Time",
      value: stats.correction,
      color: "text-blue-600",
    },
    { label: "In Location", value: stats.in_location, color: "text-green-600" },
    {
      label: "In Tolerance Location",
      value: stats.in_tolerance_location,
      color: "text-yellow-600",
    },
    {
      label: "Out of Location",
      value: stats.out_location,
      color: "text-red-600",
    },
    {
      label: "Correction Location",
      value: stats.correction_location,
      color: "text-blue-600",
    },
  ];

  const handleDetail = (row: AttendanceRow) => {
    setDetail({ attendance: row, employee: row.employee });
  };

  return (
    <div>
      <h1 className="page-title mb-6">Summary Report</h1>

      {/* Filter bar */}
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
          <button onClick={fetchData} className="btn-primary">
            <Search size={14} /> Search
          </button>
          <button onClick={handleDownload} disabled={downloading} className="btn-secondary ml-auto">
            {downloading ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Download size={14} />}
            {downloading ? 'Mengunduh...' : 'Download Report'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
        {statItems.map((s) => (
          <div key={s.label} className="card p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Table filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
          <div>
            <label className="form-label">Select Group</label>
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
          <div>
            <label className="form-label">Schedule Type</label>
            <select
              className="form-input w-40"
              value={scheduleFilter}
              onChange={(e) => setScheduleFilter(e.target.value)}
            >
              <option value="all">All Schedule</option>
              <option value="regular">Regular</option>
              <option value="shifting">Shifting</option>
            </select>
          </div>
          <div>
            <label className="form-label">Select User</label>
            <select
              className="form-input w-44"
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All User</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Time In</th>
                <th>Status In</th>
                <th>Location In</th>
                <th>Time Out</th>
                <th>Status Out</th>
                <th>Status</th>
                <th>Workhour</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <Spinner className="mx-auto" />
                  </td>
                </tr>
              ) : Object.keys(grouped).length === 0 ? (
                <EmptyState message="Tidak ada data absensi" />
              ) : (
                Object.entries(grouped)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([date, dateRows]) => (
                    <>
                      {/* Date separator */}
                      <tr key={`date-${date}`} className="bg-gray-50">
                        <td colSpan={9} className="px-4 py-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                            <FileText size={13} />
                            {new Date(date).toLocaleDateString("id-ID", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })}
                          </div>
                        </td>
                      </tr>
                      {dateRows.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-gray-50/60 transition-colors"
                        >
                          <td>
                            <div className="font-medium text-gray-900">
                              {row.employee?.full_name}
                            </div>
                            <div className="text-xs text-gray-400">
                              {row.employee?.group?.name || "-"}
                            </div>
                          </td>
                          <td className="text-gray-700">
                            {formatTime(row.time_in)}
                          </td>
                          <td>
                            <StatusBadge status={row.status_in} />
                          </td>
                          <td>
                            <LocationBadge status={row.location_in_status} />
                          </td>
                          <td className="text-gray-700">
                            {formatTime(row.time_out)}
                          </td>
                          <td>
                            {row.time_out ? (
                              <StatusBadge
                                status={row.status_out || "checked_out"}
                              />
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td>
                            {row.time_out ? (
                              <span className="badge badge-green">Present</span>
                            ) : (
                              <span className="badge badge-blue">Check In</span>
                            )}
                          </td>
                          <td className="text-gray-700 font-mono text-xs">
                            {formatMinutes(row.work_minutes)}
                          </td>
                          <td>
                            <button
                              onClick={() => handleDetail(row)}
                              className="btn-icon text-blue-500 hover:text-blue-700"
                              title="Lihat Detail"
                            >
                              <FileText size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </>
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

      {/* Detail Modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Employee Attendance Detail"
        width="max-w-2xl"
      >
        {detail && (
          <div>
            {/* Employee header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                {detail.employee.full_name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {detail.employee.full_name}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  <span>{detail.attendance.attendance_date}</span>
                  <span>·</span>
                  <span>{detail.employee.email}</span>
                  <span>·</span>
                  <span>#{detail.employee.employee_code}</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                {
                  label: "Work Time",
                  value: formatMinutes(detail.attendance.work_minutes),
                },
                {
                  label: "Late Time",
                  value: formatMinutes(detail.attendance.late_minutes),
                },
                {
                  label: "Overtime",
                  value: formatMinutes(detail.attendance.overtime_minutes),
                },
                {
                  label: "Status",
                  value: detail.attendance.time_out ? "Present" : "Check In",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-gray-50 rounded-xl p-3 text-center"
                >
                  <p className="text-base font-bold text-gray-900 font-mono">
                    {s.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Map */}
            <div className="rounded-xl overflow-hidden border border-gray-200 mb-5 h-52">
              {detail.attendance.lat_in ? (
                <MapContainer
                  key={detail.attendance.id}
                  center={[detail.attendance.lat_in, detail.attendance.lng_in!]}
                  zoom={16}
                  className="w-full h-full"
                  style={{ zIndex: 0 }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {/* Check-in marker */}
                  <Marker position={[detail.attendance.lat_in, detail.attendance.lng_in!]} icon={iconIn}>
                    <Popup>
                      <p className="font-semibold text-xs">Check-in</p>
                      <p className="text-xs text-gray-500 font-mono">{formatTime(detail.attendance.time_in)}</p>
                    </Popup>
                  </Marker>
                  <Circle
                    center={[detail.attendance.lat_in, detail.attendance.lng_in!]}
                    radius={8}
                    pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.25, weight: 2 }}
                  />
                  {/* Check-out marker */}
                  {detail.attendance.lat_out && detail.attendance.lng_out && (
                    <>
                      <Marker position={[detail.attendance.lat_out, detail.attendance.lng_out]} icon={iconOut}>
                        <Popup>
                          <p className="font-semibold text-xs">Check-out</p>
                          <p className="text-xs text-gray-500 font-mono">{formatTime(detail.attendance.time_out)}</p>
                        </Popup>
                      </Marker>
                      <Circle
                        center={[detail.attendance.lat_out, detail.attendance.lng_out]}
                        radius={8}
                        pathOptions={{ color: '#ea580c', fillColor: '#ea580c', fillOpacity: 0.25, weight: 2 }}
                      />
                    </>
                  )}
                </MapContainer>
              ) : (
                <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                  <p className="text-gray-400 text-sm">Tidak ada data lokasi</p>
                </div>
              )}
            </div>
            {detail.attendance.lat_in && (
              <div className="flex gap-4 text-xs text-gray-500 font-mono -mt-3 mb-4 px-1">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" /> Check-in: {detail.attendance.lat_in.toFixed(6)}, {detail.attendance.lng_in?.toFixed(6)}
                </span>
                {detail.attendance.lat_out && (
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> Check-out: {detail.attendance.lat_out.toFixed(6)}, {detail.attendance.lng_out?.toFixed(6)}
                  </span>
                )}
              </div>
            )}

            {/* Detail grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                {
                  label: "Time In",
                  value: formatTime(detail.attendance.time_in),
                },
                {
                  label: "Time Out",
                  value: formatTime(detail.attendance.time_out),
                },
                {
                  label: "Status In",
                  value: <StatusBadge status={detail.attendance.status_in} />,
                },
                {
                  label: "Status Out",
                  value: <StatusBadge status={detail.attendance.status_out} />,
                },
                {
                  label: "Reason In",
                  value: detail.attendance.reason_in || "-",
                },
                {
                  label: "Reason Out",
                  value: detail.attendance.reason_out || "-",
                },
                {
                  label: "Location In",
                  value: (
                    <LocationBadge
                      status={detail.attendance.location_in_status}
                    />
                  ),
                },
                {
                  label: "Location Out",
                  value: (
                    <LocationBadge
                      status={detail.attendance.location_out_status}
                    />
                  ),
                },
                { label: "Note In", value: detail.attendance.note_in || "-" },
                { label: "Note Out", value: detail.attendance.note_out || "-" },
                {
                  label: "Face Verified",
                  value: detail.attendance.face_verified ? "✓ Ya" : "✗ Tidak",
                },
                {
                  label: "Face Confidence",
                  value: detail.attendance.face_confidence
                    ? `${detail.attendance.face_confidence}%`
                    : "-",
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="text-gray-500 w-36 shrink-0">{label}</span>
                  <span className="text-gray-900 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
