import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { Download, Search, FileText } from "lucide-react";
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
  const [search, _setSearch] = useState("");

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
        query = query.eq("employee.group_id", groupFilter);
      }
      if (userFilter !== "all") {
        query = query.eq("employee_id", userFilter);
      }

      const { data, count, error } = await query.range(
        (page - 1) * pageSize,
        page * pageSize - 1,
      );

      if (error) throw error;

      const filtered = search
        ? (data || []).filter((r: AttendanceRow) =>
            r.employee?.full_name?.toLowerCase().includes(search.toLowerCase()),
          )
        : data || [];

      setRows(filtered as AttendanceRow[]);
      setTotal(count || 0);

      // Calculate stats from all data (not paginated)
      const { data: allData } = await supabase
        .from("attendances")
        .select("status_in, location_in_status")
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate);

      if (allData) {
        setStats({
          on_time: allData.filter((r) => r.status_in === "on_time").length,
          in_tolerance: allData.filter((r) => r.status_in === "in_tolerance")
            .length,
          late: allData.filter((r) => r.status_in === "late").length,
          correction: allData.filter((r) => r.status_in === "others").length,
          in_location: allData.filter((r) => r.location_in_status === "in_area")
            .length,
          in_tolerance_location: allData.filter(
            (r) => r.location_in_status === "tolerance",
          ).length,
          out_location: allData.filter(
            (r) => r.location_in_status === "out_of_area",
          ).length,
          correction_location: allData.filter(
            (r) => r.location_in_status === "correction",
          ).length,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, groupFilter, userFilter, page, pageSize, search]);

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
          <button className="btn-secondary ml-auto">
            <Download size={14} /> Download Report
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

            {/* Map placeholder */}
            <div className="bg-gray-100 rounded-xl h-40 flex items-center justify-center mb-5">
              {detail.attendance.lat_in ? (
                <div className="text-center text-sm text-gray-500">
                  <p className="font-medium">Koordinat Check-in</p>
                  <p className="font-mono text-xs mt-1">
                    {detail.attendance.lat_in?.toFixed(6)},{" "}
                    {detail.attendance.lng_in?.toFixed(6)}
                  </p>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Tidak ada data lokasi</p>
              )}
            </div>

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
